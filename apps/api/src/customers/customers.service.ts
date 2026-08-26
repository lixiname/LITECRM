import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
import {
  complaintFollowUps,
  complaints,
  contacts,
  customerGradeChanges,
  customers,
  deals,
  followUpActions,
  opportunities,
  opportunityFollowUps,
  opportunityQuotes,
  visitRecords,
} from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { GradeQuotaService } from './grade-quota.service'
import { normalizeBusinessName, normalizePhone } from './customer-normalizer'
import { scoreDuplicate, type DedupInput, type DedupScored } from './dedup'
import type { AuthUser } from '../auth/auth.service'
import type { CreateCustomerDto } from './dto/create-customer.dto'
import type { UpdateCustomerDto } from './dto/update-customer.dto'
import type { CustomerQueryDto } from './dto/customer-query.dto'
import type { CreateContactDto } from './dto/contact.dto'
import type { DedupCheckDto } from './dto/dedup-check.dto'
import { CustomerAssigneeService } from './customer-assignee.service'

// 客户域（§8.2/8.3）：建档、检索、详情、维护、联系人
// 归属治理（transfer/release/claim）与查重管道在后续阶段接入
@Injectable()
export class CustomersService {
  constructor(
    private readonly accessService: AccessService,
    private readonly gradeQuotaService: GradeQuotaService,
    private readonly assigneeService: CustomerAssigneeService,
  ) {}

  // 建档：默认 owner=建档人；名额校验与写入处于同一事务。
  // 仅 ERP 编码/信用代码唯一冲突硬拦截；名称归一化只做疑似重复提示。
  async create(dto: CreateCustomerDto, actor: AuthUser) {
    assertContactHasPhone(dto.contacts)
    const ownerId = dto.ownerId ?? actor.id

    try {
      return await this.insertCustomer(dto, ownerId, actor)
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException('客户已存在（名称/编码/信用代码查重命中）')
      throw e
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
      trigramSimilarity: sql<number>`similarity(${customers.normalizedKey}, ${key})`,
    }

    // ① 名称通道候选：trigram 预筛（% 运算符 ~0.3）或同商号首字
    const nameHits = await db
      .select(cols)
      .from(customers)
      .where(
        and(
          sql`${customers.status} != 'invalid'`,
          sql`(${customers.normalizedKey} % ${key} OR left(${customers.normalizedKey}, 1) = ${key.charAt(0)})`,
        ),
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
          city: dto.city ?? null,
          province: dto.province ?? null,
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
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions: SQL[] = [inArray(customers.ownerId, visibleIds)]

    if (query.status) conditions.push(eq(customers.status, query.status))
    if (query.grade) conditions.push(eq(customers.grade, query.grade))
    if (query.city) conditions.push(eq(customers.city, query.city))
    if (query.industry) conditions.push(eq(customers.industry, query.industry))
    if (query.customerType) conditions.push(eq(customers.customerType, query.customerType))

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
        .select()
        .from(customers)
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
    const [opportunitiesRows, recentVisits, complaintsRows, dealsSummary, latestDeals] =
      await Promise.all([
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
            sourceOpportunityId: deals.sourceOpportunityId,
          })
          .from(deals)
          .where(eq(deals.customerId, customer.id))
          .orderBy(desc(deals.occurredAt))
          .limit(6),
      ])

    const opportunityIds = opportunitiesRows.map((item) => item.id)
    const complaintIds = complaintsRows.map((item) => item.id)

    const [
      actionRows,
      quoteRows,
      opportunityFollowUpRows,
      complaintActionRows,
      complaintFollowUpRows,
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
    ])

    const opportunitiesWithContext = opportunitiesRows.map((row) => ({
      ...row,
      currentAction: actionRows.find((action) => action.opportunityId === row.id) ?? null,
      latestQuote: quoteRows.find((quote) => quote.opportunityId === row.id) ?? null,
      customerName: row.customerName,
    }))

    const complaintWithContext = complaintsRows.map((row) => ({
      ...row,
      currentAction: complaintActionRows.find((action) => action.complaintId === row.id) ?? null,
    }))

    const timeline = [
      ...recentVisits.map((visit) => ({
        type: 'visit' as const,
        id: visit.id,
        occurredAt: visit.occurredAt,
        title: '拜访',
        summary: visit.businessSituation || visit.equipmentSituation || '已完成客户拜访',
        targetType: 'customer' as const,
        targetId: customer.id,
        metadata: { method: visit.method, visitType: visit.visitType },
      })),
      ...opportunitiesWithContext.map((opp) => ({
        type: 'opportunity' as const,
        id: opp.id,
        occurredAt: opp.createdAt,
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
        title: '成交',
        summary: `¥${deal.amount}`,
        targetType: 'opportunity' as const,
        targetId: deal.sourceOpportunityId,
        metadata: { amount: deal.amount },
      })),
    ]
      .map((item) => ({ ...item, occurredAt: new Date(item.occurredAt).toISOString() }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 30)

    return {
      ...customer,
      contacts: contactList,
      opportunities: opportunitiesWithContext,
      complaints: complaintWithContext,
      dealSummary: {
        count: dealsSummary[0]?.totalCount ?? 0,
        totalAmount: dealsSummary[0]?.totalAmount ?? '0',
      },
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
            city: dto.city === undefined ? customer.city : dto.city,
            province: dto.province === undefined ? customer.province : dto.province,
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
    return db.transaction(async (tx) => {
      if (dto.isKeyContact) {
        await tx
          .update(contacts)
          .set({ isKeyContact: false, updatedAt: new Date() })
          .where(and(eq(contacts.customerId, customer.id), eq(contacts.isKeyContact, true)))
      }
      const [created] = await tx
        .insert(contacts)
        .values({
          customerId: customer.id,
          name: dto.name ?? null,
          title: dto.title ?? null,
          phone: dto.phone ?? null,
          isKeyContact: dto.isKeyContact ?? false,
        })
        .returning()
      return created
    })
  }

  async updateContact(contactId: string, dto: CreateContactDto, actor: AuthUser) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)

    return db.transaction(async (tx) => {
      await this.lockCustomerContacts(tx, contact.customerId)
      const nextPhone = dto.phone === undefined ? contact.phone : dto.phone
      if (!nextPhone?.trim() && contact.phone?.trim()) {
        await this.assertAnotherPhoneExists(tx, contact.customerId, contact.id)
      }
      if (dto.isKeyContact) {
        await tx
          .update(contacts)
          .set({ isKeyContact: false, updatedAt: new Date() })
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
          phone: nextPhone,
          isKeyContact: dto.isKeyContact ?? contact.isKeyContact,
          updatedAt: new Date(),
          version: sql`${contacts.version} + 1`,
        })
        .where(and(eq(contacts.id, contactId), eq(contacts.version, contact.version)))
        .returning()
      if (!updated) throw new ConflictException('联系人已被他人更新，请刷新后重试')
      return updated
    })
  }

  async removeContact(contactId: string, actor: AuthUser): Promise<void> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)
    await db.transaction(async (tx) => {
      await this.lockCustomerContacts(tx, contact.customerId)
      if (contact.phone?.trim()) {
        await this.assertAnotherPhoneExists(tx, contact.customerId, contact.id)
      }
      await tx.delete(contacts).where(eq(contacts.id, contactId))
    })
  }

  // ===== 内部工具 =====

  // 数据范围可见性（§7.3：详情/维护前校验）
  private async findVisible(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  // 可维护权限（§8.3）：owner / 管理链 / admin
  private async assertCanContribute(customer: typeof customers.$inferSelect, actor: AuthUser) {
    if (customer.ownerId === actor.id) return
    if (actor.role === 'admin') return
    const isManager = await this.accessService.isManagerOf(actor.id, customer.ownerId)
    if (isManager) return
    throw new ForbiddenException('无权维护该客户')
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

// PostgreSQL 唯一约束冲突（SQLSTATE 23505）：外部权威标识/首要联系人等硬约束。
// Drizzle 0.45+ 包装为 DrizzleQueryError，底层 pg 错误在 cause 上
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code === '23505' || err.cause?.code === '23505'
}
