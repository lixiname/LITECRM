import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
import {
  complaintFollowUps,
  complaints,
  contacts,
  customerGradeChanges,
  customerTransfers,
  customers,
  deals,
  followUpActions,
  opportunities,
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  visitRecords,
  salesRegions,
  users,
} from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { GradeQuotaService } from './grade-quota.service'
import { normalizeBusinessName, normalizePhone } from './customer-normalizer'
import { scoreDuplicate, type DedupInput, type DedupScored } from './dedup'
import type { AuthUser } from '../auth/auth.service'
import type { CreateCustomerDto } from './dto/create-customer.dto'
import type { UpdateCustomerDto } from './dto/update-customer.dto'
import type { CustomerQueryDto } from './dto/customer-query.dto'
import type { CreateContactDto, UpdateContactDto } from './dto/contact.dto'
import type { DedupCheckDto } from './dto/dedup-check.dto'
import { CustomerAssigneeService } from './customer-assignee.service'
import { deriveOpportunityStagnation } from '../opportunities/opportunity-stagnation'
import { GeographyService } from '../geography/geography.service'
import { businessDate } from '../common/business-date'
import { buildOpportunityActivity } from '../opportunities/opportunity-activity-projection'
import { CatalogService } from '../catalog/catalog.service'

export interface ImportedCustomerInput {
  name: string
  customerCode?: string | null
  unifiedSocialCreditCode?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  industry?: string | null
  subIndustry?: string | null
  customerType?: string | null
  source?: string | null
  grade?: 'S' | 'A' | 'B' | 'C'
  ownerId?: string | null
  status: 'active' | 'public'
  contactName?: string | null
  contactPhone?: string | null
  preCrmDealConfirmed: boolean
  preCrmSalesAmount?: string | null
  notes?: string | null
  importBatchId: string
}

// 客户域（§8.2/8.3）：建档、检索、详情、维护、联系人
// 归属治理（transfer/release/claim）与查重管道在后续阶段接入
@Injectable()
export class CustomersService {
  constructor(
    private readonly accessService: AccessService,
    private readonly gradeQuotaService: GradeQuotaService,
    private readonly assigneeService: CustomerAssigneeService,
    private readonly geographyService: GeographyService,
    private readonly catalogService: CatalogService,
  ) {}

  // 建档：默认 owner=建档人；名额校验与写入处于同一事务。
  // 仅 ERP 编码/信用代码唯一冲突硬拦截；名称归一化只做疑似重复提示。
  async create(dto: CreateCustomerDto, actor: AuthUser) {
    assertContactHasPhone(dto.contacts)
    await Promise.all(
      dto.contacts
        .filter((contact) => contact.functionRole)
        .map((contact) =>
          this.catalogService.assertDimensionValue('contact_function', contact.functionRole!),
        ),
    )
    const ownerId = dto.ownerId ?? actor.id

    try {
      return await this.insertCustomer(dto, ownerId, actor)
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException('客户已存在（名称/编码/信用代码查重命中）')
      throw e
    }
  }

  // 冷启动导入：允许联系人缺失；不伪造商机或成交，只写客户事实与可选期初金额。
  async createImportedCustomer(input: ImportedCustomerInput, actor: AuthUser) {
    try {
      return await db.transaction(async (tx) => {
        if (input.status === 'active') {
          if (!input.ownerId) throw new BadRequestException('在案客户必须指定负责人')
          await this.assigneeService.assertAssignable(tx, input.ownerId)
          await this.gradeQuotaService.assertSlotAvailable(tx, input.ownerId, input.grade ?? 'C')
        }
        const [customer] = await tx
          .insert(customers)
          .values({
            name: input.name,
            normalizedKey: normalizeBusinessName(input.name),
            customerCode: normalizeOptionalIdentifier(input.customerCode),
            unifiedSocialCreditCode: normalizeOptionalIdentifier(input.unifiedSocialCreditCode),
            province: input.province ?? null,
            city: input.city ?? null,
            address: input.address ?? null,
            industry: input.industry ?? null,
            subIndustry: input.subIndustry ?? null,
            customerType: input.customerType ?? null,
            source: input.source ?? null,
            grade: input.grade ?? 'C',
            status: input.status,
            ownerId: input.status === 'active' ? input.ownerId : null,
            createdById: actor.id,
            preCrmDealConfirmed: input.preCrmDealConfirmed,
            preCrmSalesAmount: input.preCrmSalesAmount ?? null,
            importBatchId: input.importBatchId,
            notes: input.notes ?? null,
            entrySource: 'excel_import',
          })
          .returning()
        if (input.contactName || input.contactPhone) {
          await tx.insert(contacts).values({
            customerId: customer.id,
            name: input.contactName ?? null,
            phone: input.contactPhone ?? null,
            isKeyContact: true,
          })
        }
        return customer
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('客户编码或信用代码已存在')
      throw error
    }
  }

  // 查重预检（§8.2 五步）：候选生成（Blocking）→ 相似度比较 → 置信度分级
  async checkDuplicate(dto: DedupCheckDto): Promise<DedupScored[]> {
    const key = normalizeBusinessName(dto.name)
    const phone = dto.phone ? normalizePhone(dto.phone) : null
    if (!key) return []

    const candidates = await this.queryDedupCandidates(key, phone)
    const input: DedupInput = {
      name: dto.name,
      normalizedKey: key,
      phone,
      address: dto.address ?? null,
    }

    const results: DedupScored[] = []
    for (const c of candidates) {
      const scored = scoreDuplicate(c, input)
      if (scored) results.push(scored)
    }
    // 按置信度降序：high > medium > low（§8.2 前端弹疑似列表）
    const rank = { high: 0, medium: 1, low: 2 }
    return results.sort((a, b) => rank[a.confidence] - rank[b.confidence])
  }

  // 候选生成（Blocking，§8.2 步③）：名称/trigram/首字 候选 + 电话命中候选（分步查询，JS 归一化比较）
  private async queryDedupCandidates(key: string, phone: string | null) {
    const cols = {
      id: customers.id,
      name: customers.name,
      normalizedKey: customers.normalizedKey,
      city: customers.city,
      address: customers.address,
      status: sql<'active' | 'public' | 'invalid'>`${customers.status}`,
      trigramSimilarity: sql<number>`similarity(${customers.normalizedKey}, ${key})`,
    }

    // ① 名称通道候选：trigram 预筛（% 运算符 ~0.3）或同商号首字
    const nameHits = await db
      .select(cols)
      .from(customers)
      .where(
        sql`(${customers.normalizedKey} % ${key} OR left(${customers.normalizedKey}, 1) = ${key.charAt(0)})`,
      )
      .limit(10)

    // ② 电话通道候选：联系人电话归一化后精确命中
    let phoneIds: string[] = []
    if (phone) {
      const hits = await db
        .select({ customerId: contacts.customerId })
        .from(contacts)
        .where(sql`regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') = ${phone}`)
      phoneIds = [...new Set(hits.map((h) => h.customerId))]
      const missing = phoneIds.filter((id) => !nameHits.some((c) => c.id === id))
      if (missing.length > 0) {
        const extra = await db.select(cols).from(customers).where(inArray(customers.id, missing))
        nameHits.push(...extra)
      }
    }

    // ③ 电话匹配标记（JS 归一化比较，§8.2 电话精确=高置信度）
    const candidates = nameHits.map((c) => ({ ...c, phoneMatched: false }))
    if (phone && candidates.length > 0) {
      const contactList = await db
        .select({ customerId: contacts.customerId, phone: contacts.phone })
        .from(contacts)
        .where(
          inArray(
            contacts.customerId,
            candidates.map((c) => c.id),
          ),
        )
      const matchedIds = new Set(
        contactList.filter((c) => normalizePhone(c.phone ?? '') === phone).map((c) => c.customerId),
      )
      for (const c of candidates) if (matchedIds.has(c.id)) c.phoneMatched = true
    }
    return candidates
  }

  private async insertCustomer(dto: CreateCustomerDto, ownerId: string, actor: AuthUser) {
    return db.transaction(async (tx) => {
      const grade = dto.grade ?? 'C'
      await this.assigneeService.assertAssignable(tx, ownerId)
      await this.gradeQuotaService.assertSlotAvailable(tx, ownerId, grade)
      const location =
        dto.provinceCode !== undefined || dto.cityCode !== undefined
          ? await this.geographyService.resolveLocation(tx, dto.provinceCode, dto.cityCode)
          : {
              provinceCode: null,
              province: dto.province ?? null,
              cityCode: null,
              city: dto.city ?? null,
              salesRegionId: null,
            }

      const [customer] = await tx
        .insert(customers)
        .values({
          name: dto.name,
          normalizedKey: normalizeBusinessName(dto.name),
          customerCode: normalizeOptionalIdentifier(dto.customerCode),
          unifiedSocialCreditCode: normalizeOptionalIdentifier(dto.unifiedSocialCreditCode),
          aliasNames: dto.aliasNames ?? [],
          industry: dto.industry ?? null,
          subIndustry: dto.subIndustry ?? null,
          customerType: dto.customerType ?? null,
          productLines: dto.productLines ?? [],
          ...location,
          address: dto.address ?? null,
          website: dto.website ?? null,
          source: dto.source ?? null,
          grade,
          ownerId,
          createdById: actor.id,
          notes: dto.notes ?? null,
        })
        .returning()

      if (dto.contacts.length > 0) {
        await tx.insert(contacts).values(
          dto.contacts.map((c) => ({
            customerId: customer.id,
            name: c.name ?? null,
            title: c.title ?? null,
            functionRole: c.functionRole ?? null,
            phone: c.phone ?? null,
            isKeyContact: c.isKeyContact ?? false,
          })),
        )
      }
      return customer
    })
  }

  // 检索（§7.3）：数据范围过滤 + 五级排序 + 分页
  async findAll(query: CustomerQueryDto, actor: AuthUser) {
    const requestedStatus = query.status ?? 'active'
    const conditions: SQL[] = [await this.listVisibilityCondition(requestedStatus, actor)]
    if (query.grade) conditions.push(eq(customers.grade, query.grade))
    if (query.city) conditions.push(eq(customers.city, query.city))
    if (query.industry) conditions.push(eq(customers.industry, query.industry))
    if (query.customerType) conditions.push(eq(customers.customerType, query.customerType))
    if (query.relationshipStage) {
      const yearStart = sql`date_trunc('year', now() at time zone 'Asia/Shanghai')::date`
      if (query.relationshipStage === 'prospect') {
        conditions.push(
          and(eq(customers.preCrmDealConfirmed, false), isNull(customers.firstDealAt))!,
        )
      } else if (query.relationshipStage === 'new_customer') {
        conditions.push(
          and(
            eq(customers.preCrmDealConfirmed, false),
            sql`(${customers.firstDealAt} at time zone 'Asia/Shanghai')::date >= ${yearStart}`,
          )!,
        )
      } else {
        conditions.push(
          or(
            eq(customers.preCrmDealConfirmed, true),
            sql`(${customers.firstDealAt} at time zone 'Asia/Shanghai')::date < ${yearStart}`,
          )!,
        )
      }
    }

    // 关键字（§7.3 检索排序）：完全 > 前缀 > 包含 > 别名 > trigram > 城市
    const kw = query.keyword?.trim()
    const orderBy: SQL = kw
      ? sql`CASE
          WHEN ${customers.name} = ${kw} THEN 0
          WHEN ${customers.name} ILIKE ${kw + '%'} THEN 1
          WHEN ${customers.name} ILIKE ${'%' + kw + '%'} THEN 2
          WHEN ${customers.aliasNames} @> ${JSON.stringify([kw])}::jsonb THEN 3
          WHEN similarity(${customers.normalizedKey}, ${kw}) > 0.3 THEN 4
          WHEN ${customers.city} ILIKE ${'%' + kw + '%'} THEN 5
          ELSE 6 END`
      : desc(customers.updatedAt)
    if (kw) {
      conditions.push(
        sql`(${customers.name} = ${kw}
          OR ${customers.name} ILIKE ${kw + '%'}
          OR ${customers.name} ILIKE ${'%' + kw + '%'}
          OR ${customers.aliasNames} @> ${JSON.stringify([kw])}::jsonb
          OR similarity(${customers.normalizedKey}, ${kw}) > 0.3
          OR ${customers.city} ILIKE ${'%' + kw + '%'})`,
      )
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = and(...conditions)

    const [totalRows, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(where),
      db
        .select({
          ...getTableColumns(customers),
          ownerName: users.displayName,
          salesRegionName: salesRegions.name,
          relationshipStage: customerRelationshipStageSql(),
          openOpportunityCount: sql<number>`(
            select count(*)::int from ${opportunities}
            where ${opportunities.customerId} = ${customers.id}
              and ${opportunities.stage} in ('intent','following')
          )`,
          openOpportunityAmount: sql<string>`coalesce((
            select sum(${opportunities.estimatedAmount}) from ${opportunities}
            where ${opportunities.customerId} = ${customers.id}
              and ${opportunities.stage} in ('intent','following')
          ), 0)::text`,
          activeOpportunityStage: sql<string | null>`(
            select case
              when bool_or(${opportunities.stage} = 'following') then 'following'
              when bool_or(${opportunities.stage} = 'intent') then 'intent'
              else null
            end
            from ${opportunities}
            where ${opportunities.customerId} = ${customers.id}
              and ${opportunities.stage} in ('intent','following')
          )`,
          nextActionAt: sql<Date | null>`(
            select min(${followUpActions.plannedAt}) from ${followUpActions}
            where ${followUpActions.customerId} = ${customers.id}
              and ${followUpActions.status} = 'pending'
          )`,
          nextActionContent: sql<string | null>`(
            select ${followUpActions.content} from ${followUpActions}
            where ${followUpActions.customerId} = ${customers.id}
              and ${followUpActions.status} = 'pending'
            order by ${followUpActions.plannedAt} asc limit 1
          )`,
        })
        .from(customers)
        .leftJoin(users, eq(customers.ownerId, users.id))
        .leftJoin(salesRegions, eq(customers.salesRegionId, salesRegions.id))
        .where(where)
        .orderBy(orderBy, asc(customers.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ])

    return { items: rows, total: totalRows[0].count, page, pageSize }
  }

  // 详情（§7.3：详情必须走权限校验 = 数据范围可见）
  async findOne(id: string, actor: AuthUser) {
    const customer = await this.findVisible(id, actor)
    const contactList = await db
      .select()
      .from(contacts)
      .where(eq(contacts.customerId, customer.id))
      .orderBy(desc(contacts.isKeyContact), asc(contacts.createdAt))
    const [
      opportunitiesRows,
      recentVisits,
      complaintsRows,
      dealsSummary,
      latestDeals,
      currentVisitPlanRows,
      customerSalesRegionRows,
      ownershipRows,
    ] = await Promise.all([
      db
        .select({
          ...getTableColumns(opportunities),
          customerName: customers.name,
        })
        .from(opportunities)
        .innerJoin(customers, eq(opportunities.customerId, customers.id))
        .where(eq(opportunities.customerId, customer.id))
        .orderBy(desc(opportunities.updatedAt)),
      db
        .select()
        .from(visitRecords)
        .where(eq(visitRecords.customerId, customer.id))
        .orderBy(desc(visitRecords.occurredAt))
        .limit(12),
      db
        .select()
        .from(complaints)
        .where(eq(complaints.customerId, customer.id))
        .orderBy(desc(complaints.occurredAt))
        .limit(12),
      db
        .select({
          totalCount: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${deals.amount}), 0)::text`,
        })
        .from(deals)
        .where(eq(deals.customerId, customer.id)),
      db
        .select({
          id: deals.id,
          amount: deals.amount,
          occurredAt: deals.occurredAt,
          createdAt: deals.createdAt,
          sourceOpportunityId: deals.sourceOpportunityId,
        })
        .from(deals)
        .where(eq(deals.customerId, customer.id))
        .orderBy(desc(deals.occurredAt))
        .limit(6),
      db
        .select()
        .from(followUpActions)
        .where(
          and(
            eq(followUpActions.customerId, customer.id),
            eq(followUpActions.planKind, 'customer_visit'),
            eq(followUpActions.status, 'pending'),
          ),
        )
        .orderBy(asc(followUpActions.plannedAt))
        .limit(1),
      customer.salesRegionId
        ? db
            .select({ name: salesRegions.name })
            .from(salesRegions)
            .where(eq(salesRegions.id, customer.salesRegionId))
            .limit(1)
        : Promise.resolve([] as { name: string }[]),
      db
        .select()
        .from(customerTransfers)
        .where(eq(customerTransfers.customerId, customer.id))
        .orderBy(desc(customerTransfers.occurredAt))
        .limit(20),
    ])

    const ownershipUserIds = [
      ...new Set(
        ownershipRows.flatMap((item) =>
          [item.fromOwnerId, item.toOwnerId, item.operatedById].filter((value): value is string =>
            Boolean(value),
          ),
        ),
      ),
    ]
    const ownershipUsers = ownershipUserIds.length
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, ownershipUserIds))
      : []
    const ownershipUserName = (userId: string | null) =>
      userId ? (ownershipUsers.find((user) => user.id === userId)?.displayName ?? '未知人员') : null

    const opportunityIds = opportunitiesRows.map((item) => item.id)
    const complaintIds = complaintsRows.map((item) => item.id)

    const [
      actionRows,
      quoteRows,
      opportunityFollowUpRows,
      opportunityProductLineRows,
      complaintActionRows,
      complaintFollowUpRows,
      opportunityDealRows,
    ] = await Promise.all([
      opportunityIds.length
        ? db
            .select()
            .from(followUpActions)
            .where(
              and(
                inArray(followUpActions.opportunityId, opportunityIds),
                eq(followUpActions.status, 'pending'),
              ),
            )
            .orderBy(asc(followUpActions.plannedAt))
        : Promise.resolve([] as (typeof followUpActions.$inferSelect)[]),
      opportunityIds.length
        ? db
            .select()
            .from(opportunityQuotes)
            .where(inArray(opportunityQuotes.opportunityId, opportunityIds))
            .orderBy(desc(opportunityQuotes.quotedAt))
        : Promise.resolve([] as (typeof opportunityQuotes.$inferSelect)[]),
      opportunityIds.length
        ? db
            .select()
            .from(opportunityFollowUps)
            .where(inArray(opportunityFollowUps.opportunityId, opportunityIds))
            .orderBy(desc(opportunityFollowUps.occurredAt))
        : Promise.resolve([] as (typeof opportunityFollowUps.$inferSelect)[]),
      opportunityIds.length
        ? db
            .select()
            .from(opportunityProductLines)
            .where(inArray(opportunityProductLines.opportunityId, opportunityIds))
        : Promise.resolve([] as (typeof opportunityProductLines.$inferSelect)[]),
      complaintIds.length
        ? db
            .select()
            .from(followUpActions)
            .where(
              and(
                inArray(followUpActions.complaintId, complaintIds),
                eq(followUpActions.status, 'pending'),
              ),
            )
            .orderBy(asc(followUpActions.plannedAt))
        : Promise.resolve([] as (typeof followUpActions.$inferSelect)[]),
      complaintIds.length
        ? db
            .select()
            .from(complaintFollowUps)
            .where(inArray(complaintFollowUps.complaintId, complaintIds))
            .orderBy(desc(complaintFollowUps.occurredAt))
        : Promise.resolve([] as (typeof complaintFollowUps.$inferSelect)[]),
      opportunityIds.length
        ? db
            .select()
            .from(deals)
            .where(inArray(deals.sourceOpportunityId, opportunityIds))
            .orderBy(desc(deals.occurredAt))
        : Promise.resolve([] as (typeof deals.$inferSelect)[]),
    ])

    const opportunitiesWithContext = opportunitiesRows.map((row) => {
      const currentAction = actionRows.find((action) => action.opportunityId === row.id) ?? null
      const latestQuote =
        quoteRows.find((quote) => quote.opportunityId === row.id && quote.status === 'active') ??
        null
      const latestFollowUp =
        opportunityFollowUpRows.find((followUp) => followUp.opportunityId === row.id) ?? null
      return {
        ...row,
        currentAction,
        latestQuote,
        latestFollowUp,
        productLines: opportunityProductLineRows
          .filter((item) => item.opportunityId === row.id)
          .map((item) => item.productLine),
        referenceAmount: latestQuote?.amount ?? row.estimatedAmount,
        amountBasis: latestQuote ? `${latestQuote.kind}_quote` : row.initialAmountBasis,
        activity: buildOpportunityActivity(
          row,
          opportunityFollowUpRows.filter((item) => item.opportunityId === row.id),
          quoteRows.filter((item) => item.opportunityId === row.id),
          opportunityDealRows.find((item) => item.sourceOpportunityId === row.id),
        ).slice(0, 5),
        customerName: row.customerName,
        ...deriveOpportunityStagnation(row, currentAction, latestQuote, latestFollowUp),
      }
    })

    const complaintWithContext = complaintsRows.map((row) => ({
      ...row,
      currentAction: complaintActionRows.find((action) => action.complaintId === row.id) ?? null,
    }))

    const timeline = [
      ...recentVisits.map((visit) => ({
        type: 'visit' as const,
        id: visit.id,
        occurredAt: visit.occurredAt,
        sortAt: visit.createdAt,
        title: '拜访',
        summary: visit.businessSituation || visit.equipmentSituation || '已完成客户拜访',
        targetType: 'customer' as const,
        targetId: customer.id,
        metadata: { method: visit.method, visitType: visit.visitType },
      })),
      ...opportunitiesWithContext.map((opp) => ({
        type: 'opportunity' as const,
        id: opp.id,
        occurredAt: opp.discoveredDate ?? businessDate(opp.createdAt),
        sortAt: opp.createdAt,
        title: '新建商机',
        summary: opp.name,
        targetType: 'opportunity' as const,
        targetId: opp.id,
        metadata: { stage: opp.stage },
      })),
      ...opportunityFollowUpRows.map((followUp) => {
        const opportunity = opportunitiesWithContext.find(
          (item) => item.id === followUp.opportunityId,
        )
        return {
          type: 'opportunity_follow_up' as const,
          id: followUp.id,
          occurredAt: followUp.occurredAt,
          sortAt: followUp.createdAt,
          title: '商机跟进',
          summary: followUp.conclusion,
          targetType: 'opportunity' as const,
          targetId: followUp.opportunityId,
          metadata: { opportunityName: opportunity?.name ?? null, method: followUp.method },
        }
      }),
      ...quoteRows.map((quote) => ({
        type: 'quote' as const,
        id: quote.id,
        occurredAt: quote.quotedAt,
        sortAt: quote.createdAt,
        title: quote.kind === 'formal' ? '正式报价' : '口头报价',
        summary: `¥${quote.amount}`,
        targetType: 'opportunity' as const,
        targetId: quote.opportunityId,
        metadata: { kind: quote.kind, status: quote.status, quoteNo: quote.quoteNo },
      })),
      ...complaintWithContext.map((complaint) => ({
        type: 'complaint' as const,
        id: complaint.id,
        occurredAt: complaint.occurredAt,
        sortAt: complaint.createdAt,
        title: '登记客诉',
        summary: complaint.description,
        targetType: 'complaint' as const,
        targetId: complaint.id,
        metadata: { status: complaint.status, complaintType: complaint.type },
      })),
      ...complaintFollowUpRows.map((followUp) => ({
        type: 'complaint_follow_up' as const,
        id: followUp.id,
        occurredAt: followUp.occurredAt,
        sortAt: followUp.createdAt,
        title: followUp.outcome === 'resolved' ? '客诉解决' : '客诉跟进',
        summary: followUp.content,
        targetType: 'complaint' as const,
        targetId: followUp.complaintId,
        metadata: { outcome: followUp.outcome },
      })),
      ...latestDeals.map((deal) => ({
        type: 'deal' as const,
        id: deal.id,
        occurredAt: deal.occurredAt,
        sortAt: deal.createdAt,
        title: '成交',
        summary: `¥${deal.amount}`,
        targetType: 'opportunity' as const,
        targetId: deal.sourceOpportunityId,
        metadata: { amount: deal.amount },
      })),
      ...ownershipRows.map((event) => {
        const fromOwnerName = ownershipUserName(event.fromOwnerId)
        const toOwnerName = ownershipUserName(event.toOwnerId)
        return {
          type: 'ownership_event' as const,
          id: event.id,
          occurredAt: event.occurredAt,
          sortAt: event.createdAt,
          title: ownershipEventTitle(event.eventType),
          summary: ownershipEventSummary(event.eventType, fromOwnerName, toOwnerName, event.reason),
          targetType: 'customer' as const,
          targetId: customer.id,
          metadata: {
            eventType: event.eventType,
            operatedByName: ownershipUserName(event.operatedById),
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
          },
        }
      }),
    ]
      .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
      .slice(0, 30)
      .map(({ sortAt: _, ...item }) => item)

    return {
      ...customer,
      relationshipStage: deriveCustomerRelationshipStage(customer),
      salesRegionName: customerSalesRegionRows[0]?.name ?? null,
      contacts: contactList,
      opportunities: opportunitiesWithContext,
      complaints: complaintWithContext,
      dealSummary: {
        count: dealsSummary[0]?.totalCount ?? 0,
        crmAmount: dealsSummary[0]?.totalAmount ?? '0',
        preCrmAmount: customer.preCrmSalesAmount,
        referenceTotalAmount: addAmounts(
          customer.preCrmSalesAmount,
          dealsSummary[0]?.totalAmount ?? '0',
        ),
      },
      currentVisitPlan: currentVisitPlanRows[0] ?? null,
      timeline,
      latestDeals,
    }
  }

  // 维护（§8.3 assertCanContribute：owner / 管理链 / admin）
  async update(id: string, dto: UpdateCustomerDto, actor: AuthUser) {
    const customer = await this.findVisible(id, actor)
    await this.assertCanContribute(customer, actor)

    try {
      return await db.transaction(async (tx) => {
        const nextGrade = dto.grade ?? customer.grade
        if (nextGrade !== customer.grade && !dto.gradeChangeReason?.trim()) {
          throw new BadRequestException('调整客户等级必须填写原因')
        }
        if (nextGrade !== customer.grade && customer.ownerId && customer.status === 'active') {
          await this.gradeQuotaService.assertSlotAvailable(tx, customer.ownerId, nextGrade)
        }
        const shouldResolveLocation = dto.provinceCode !== undefined || dto.cityCode !== undefined
        const nextProvinceCode =
          dto.provinceCode === undefined ? customer.provinceCode : dto.provinceCode
        const nextCityCode =
          dto.cityCode !== undefined
            ? dto.cityCode
            : dto.provinceCode !== undefined && dto.provinceCode !== customer.provinceCode
              ? null
              : customer.cityCode
        const location = shouldResolveLocation
          ? await this.geographyService.resolveLocation(tx, nextProvinceCode, nextCityCode)
          : null

        const [updated] = await tx
          .update(customers)
          .set({
            name: dto.name ?? customer.name,
            normalizedKey: dto.name ? normalizeBusinessName(dto.name) : customer.normalizedKey,
            customerCode:
              dto.customerCode === undefined
                ? customer.customerCode
                : normalizeOptionalIdentifier(dto.customerCode),
            unifiedSocialCreditCode:
              dto.unifiedSocialCreditCode === undefined
                ? customer.unifiedSocialCreditCode
                : normalizeOptionalIdentifier(dto.unifiedSocialCreditCode),
            industry: dto.industry === undefined ? customer.industry : dto.industry,
            subIndustry: dto.subIndustry === undefined ? customer.subIndustry : dto.subIndustry,
            customerType: dto.customerType === undefined ? customer.customerType : dto.customerType,
            productLines: dto.productLines === undefined ? customer.productLines : dto.productLines,
            city: shouldResolveLocation
              ? location!.city
              : dto.city === undefined
                ? customer.city
                : dto.city,
            province: shouldResolveLocation
              ? location!.province
              : dto.province === undefined
                ? customer.province
                : dto.province,
            cityCode: shouldResolveLocation ? location!.cityCode : customer.cityCode,
            provinceCode: shouldResolveLocation ? location!.provinceCode : customer.provinceCode,
            salesRegionId: shouldResolveLocation ? location!.salesRegionId : customer.salesRegionId,
            address: dto.address === undefined ? customer.address : dto.address,
            website: dto.website === undefined ? customer.website : dto.website,
            source: dto.source === undefined ? customer.source : dto.source,
            grade: nextGrade,
            notes: dto.notes === undefined ? customer.notes : dto.notes,
            updatedAt: new Date(),
            version: sql`${customers.version} + 1`,
          })
          .where(and(eq(customers.id, customer.id), eq(customers.version, dto.version)))
          .returning()
        if (!updated) throw new ConflictException('客户资料已被他人更新，请刷新后重试')

        if (nextGrade !== customer.grade) {
          await tx.insert(customerGradeChanges).values({
            customerId: customer.id,
            fromGrade: customer.grade,
            toGrade: nextGrade,
            changedById: actor.id,
            reason: dto.gradeChangeReason?.trim() || null,
          })
        }
        return updated
      })
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('ERP 客户编码或信用代码已被使用')
      throw e
    }
  }

  // ===== 联系人（§7.2）=====

  async addContact(customerId: string, dto: CreateContactDto, actor: AuthUser) {
    const customer = await this.findVisible(customerId, actor)
    await this.assertCanContribute(customer, actor)
    if (dto.functionRole) {
      await this.catalogService.assertDimensionValue('contact_function', dto.functionRole)
    }
    return db.transaction(async (tx) => {
      if (dto.isKeyContact) {
        await tx
          .update(contacts)
          .set({
            isKeyContact: false,
            updatedAt: new Date(),
            version: sql`${contacts.version} + 1`,
          })
          .where(and(eq(contacts.customerId, customer.id), eq(contacts.isKeyContact, true)))
      }
      const [created] = await tx
        .insert(contacts)
        .values({
          customerId: customer.id,
          name: dto.name ?? null,
          title: dto.title ?? null,
          functionRole: dto.functionRole ?? null,
          phone: dto.phone ?? null,
          isKeyContact: dto.isKeyContact ?? false,
        })
        .returning()
      return created
    })
  }

  async updateContact(contactId: string, dto: UpdateContactDto, actor: AuthUser) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    if (contact.version !== dto.version) {
      throw new ConflictException('联系人已被他人更新，请刷新后重试')
    }
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)
    if (dto.functionRole) {
      await this.catalogService.assertDimensionValue('contact_function', dto.functionRole)
    }

    return db.transaction(async (tx) => {
      await this.lockCustomerContacts(tx, contact.customerId)
      const nextPhone = dto.phone === undefined ? contact.phone : dto.phone
      if (!nextPhone?.trim() && contact.phone?.trim()) {
        await this.assertAnotherPhoneExists(tx, contact.customerId, contact.id)
      }
      if (dto.isKeyContact) {
        await tx
          .update(contacts)
          .set({
            isKeyContact: false,
            updatedAt: new Date(),
            version: sql`${contacts.version} + 1`,
          })
          .where(
            and(
              eq(contacts.customerId, contact.customerId),
              eq(contacts.isKeyContact, true),
              sql`${contacts.id} <> ${contact.id}`,
            ),
          )
      }
      const [updated] = await tx
        .update(contacts)
        .set({
          name: dto.name === undefined ? contact.name : dto.name,
          title: dto.title === undefined ? contact.title : dto.title,
          functionRole:
            dto.functionRole === undefined ? contact.functionRole : dto.functionRole || null,
          phone: nextPhone,
          isKeyContact: dto.isKeyContact ?? contact.isKeyContact,
          updatedAt: new Date(),
          version: sql`${contacts.version} + 1`,
        })
        .where(and(eq(contacts.id, contactId), eq(contacts.version, dto.version)))
        .returning()
      if (!updated) throw new ConflictException('联系人已被他人更新，请刷新后重试')
      return updated
    })
  }

  async removeContact(contactId: string, version: number, actor: AuthUser): Promise<void> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    if (!Number.isInteger(version) || contact.version !== version) {
      throw new ConflictException('联系人已被他人更新，请刷新后重试')
    }
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)
    await db.transaction(async (tx) => {
      await this.lockCustomerContacts(tx, contact.customerId)
      if (contact.phone?.trim()) {
        await this.assertAnotherPhoneExists(tx, contact.customerId, contact.id)
      }
      const [removed] = await tx
        .delete(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.version, version)))
        .returning({ id: contacts.id })
      if (!removed) throw new ConflictException('联系人已被他人更新，请刷新后重试')
    })
  }

  // ===== 内部工具 =====

  // 数据范围可见性（§7.3：详情/维护前校验）
  private async findVisible(id: string, actor: AuthUser) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    if (customer.status === 'active') {
      const visibleIds = await this.accessService.getVisibleUserIds(actor)
      if (!customer.ownerId || !visibleIds.includes(customer.ownerId)) {
        throw new NotFoundException('客户不存在')
      }
    } else if (customer.status === 'public') {
      if (!(await this.canAccessPool(customer.salesRegionId, actor))) {
        throw new NotFoundException('客户不存在')
      }
    } else if (!(await this.canAccessInvalid(customer.salesRegionId, actor))) {
      throw new NotFoundException('客户不存在')
    }
    return customer
  }

  // 可维护权限（§8.3）：owner / 管理链 / admin
  private async assertCanContribute(customer: typeof customers.$inferSelect, actor: AuthUser) {
    if (customer.status !== 'active') throw new ConflictException('仅在案客户可维护资料')
    if (customer.ownerId === actor.id) return
    if (actor.role === 'admin') return
    const isManager = await this.accessService.isManagerOf(actor.id, customer.ownerId)
    if (isManager) return
    throw new ForbiddenException('无权维护该客户')
  }

  private async listVisibilityCondition(status: 'active' | 'public' | 'invalid', actor: AuthUser) {
    if (status === 'active') {
      const visibleIds = await this.accessService.getVisibleUserIds(actor)
      return and(eq(customers.status, 'active'), inArray(customers.ownerId, visibleIds))!
    }
    const regionId = await this.resolveActorSalesRegionId(actor.id)
    const regionScope = regionId
      ? or(eq(customers.salesRegionId, regionId), isNull(customers.salesRegionId))!
      : isNull(customers.salesRegionId)
    if (status === 'public') {
      if (actor.role === 'admin') return eq(customers.status, 'public')
      if (actor.role !== 'sales' && actor.role !== 'executive') return sql`false`
      return and(eq(customers.status, 'public'), regionScope)!
    }
    if (actor.role === 'admin') return eq(customers.status, 'invalid')
    if (actor.role !== 'executive') return sql`false`
    return and(eq(customers.status, 'invalid'), regionScope)!
  }

  private async canAccessPool(salesRegionId: string | null, actor: AuthUser) {
    if (actor.role === 'admin') return true
    if (actor.role !== 'sales' && actor.role !== 'executive') return false
    if (!salesRegionId) return true
    return (await this.resolveActorSalesRegionId(actor.id)) === salesRegionId
  }

  private async canAccessInvalid(salesRegionId: string | null, actor: AuthUser) {
    if (actor.role === 'admin') return true
    if (actor.role !== 'executive') return false
    if (!salesRegionId) return true
    return (await this.resolveActorSalesRegionId(actor.id)) === salesRegionId
  }

  private async resolveActorSalesRegionId(actorId: string): Promise<string | null> {
    const [row] = await db
      .select({ salesRegionId: users.salesRegionId })
      .from(users)
      .where(eq(users.id, actorId))
      .limit(1)
    return row?.salesRegionId ?? null
  }

  private async lockCustomerContacts(tx: DbClient, customerId: string) {
    await tx.execute(
      sql`select id from ${customers} where ${customers.id} = ${customerId} for update`,
    )
  }

  private async assertAnotherPhoneExists(
    tx: DbClient,
    customerId: string,
    excludingContactId: string,
  ) {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.customerId, customerId),
          sql`${contacts.id} <> ${excludingContactId}`,
          sql`${contacts.phone} is not null and btrim(${contacts.phone}) <> ''`,
        ),
      )
    if ((row?.count ?? 0) === 0) {
      throw new BadRequestException('每个客户至少需要保留一个联系人电话')
    }
  }
}

// 应用层约束（§8.2）：联系人至少一个含电话（裸电话场景也算）
function assertContactHasPhone(contactList: CreateContactDto[]): void {
  const hasPhone = contactList.some((c) => c.phone?.trim())
  if (!hasPhone) throw new ForbiddenException('至少需要一个联系人电话')
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function customerRelationshipStageSql() {
  return sql<'prospect' | 'new_customer' | 'existing_customer'>`case
    when ${customers.preCrmDealConfirmed} then 'existing_customer'
    when ${customers.firstDealAt} is null then 'prospect'
    when (${customers.firstDealAt} at time zone 'Asia/Shanghai')::date >=
      date_trunc('year', now() at time zone 'Asia/Shanghai')::date then 'new_customer'
    else 'existing_customer'
  end`
}

function deriveCustomerRelationshipStage(customer: typeof customers.$inferSelect) {
  if (customer.preCrmDealConfirmed) return 'existing_customer' as const
  if (!customer.firstDealAt) return 'prospect' as const
  const firstDealYear = new Date(customer.firstDealAt).getFullYear()
  return firstDealYear === new Date().getFullYear()
    ? ('new_customer' as const)
    : ('existing_customer' as const)
}

function addAmounts(left: string | null, right: string): string {
  return (Number(left ?? 0) + Number(right)).toFixed(2)
}

function ownershipEventTitle(eventType: string): string {
  const labels: Record<string, string> = {
    transferred: '负责人移交',
    released_to_pool: '释放至公海',
    claimed_from_pool: '从公海认领',
    marked_invalid: '标记无效',
    restored_from_invalid: '恢复经营',
    claim_approved: '接管审批通过',
  }
  return labels[eventType] ?? '客户归属变更'
}

function ownershipEventSummary(
  eventType: string,
  fromOwnerName: string | null,
  toOwnerName: string | null,
  reason: string,
): string {
  const change =
    eventType === 'released_to_pool'
      ? `${fromOwnerName ?? '原负责人'}释放客户`
      : eventType === 'marked_invalid'
        ? `${fromOwnerName ?? '原负责人'}停止经营客户`
        : eventType === 'claimed_from_pool'
          ? `${toOwnerName ?? '新负责人'}认领客户`
          : eventType === 'restored_from_invalid'
            ? `恢复并分配给${toOwnerName ?? '新负责人'}`
            : `${fromOwnerName ?? '未分配'} → ${toOwnerName ?? '未分配'}`
  return `${change}；${reason}`
}

// PostgreSQL 唯一约束冲突（SQLSTATE 23505）：外部权威标识/首要联系人等硬约束。
// Drizzle 0.45+ 包装为 DrizzleQueryError，底层 pg 错误在 cause 上
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code === '23505' || err.cause?.code === '23505'
}
