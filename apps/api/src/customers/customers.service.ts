import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '../common/db/db'
import { contacts, customers } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { normalizeBusinessName } from './customer-normalizer'
import type { AuthUser } from '../auth/auth.service'
import type { CreateCustomerDto } from './dto/create-customer.dto'
import type { UpdateCustomerDto } from './dto/update-customer.dto'
import type { CustomerQueryDto } from './dto/customer-query.dto'
import type { CreateContactDto } from './dto/contact.dto'

// 客户域（§8.2/8.3）：建档、检索、详情、维护、联系人
// 归属治理（transfer/release/claim）与查重管道在后续阶段接入
@Injectable()
export class CustomersService {
  constructor(private readonly accessService: AccessService) {}

  // 建档（§8.3）：默认 owner=建档人；指定 ownerId 时 D 阶段补容量校验
  // 查重硬拦截（§8.2 步②）：唯一键冲突（normalized_key/code/信用代码）→ 409
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

  private async insertCustomer(dto: CreateCustomerDto, ownerId: string, actor: AuthUser) {
    return db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          name: dto.name,
          normalizedKey: normalizeBusinessName(dto.name),
          customerCode: dto.customerCode ?? null,
          unifiedSocialCreditCode: dto.unifiedSocialCreditCode ?? null,
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
          level: dto.level ?? 'C',
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
    if (query.level) conditions.push(eq(customers.level, query.level))
    if (query.city) conditions.push(eq(customers.city, query.city))
    if (query.industry) conditions.push(eq(customers.industry, query.industry))
    if (query.customerType) conditions.push(eq(customers.customerType, query.customerType))

    // 关键字：完全 > 前缀 > 包含 > 城市兜底（§7.3 检索排序）
    const kw = query.keyword?.trim()
    const orderBy: SQL = kw
      ? sql`CASE
          WHEN ${customers.name} = ${kw} THEN 0
          WHEN ${customers.name} ILIKE ${kw + '%'} THEN 1
          WHEN ${customers.name} ILIKE ${'%' + kw + '%'} THEN 2
          WHEN ${customers.city} ILIKE ${'%' + kw + '%'} THEN 3
          ELSE 4 END`
      : desc(customers.updatedAt)
    if (kw) {
      conditions.push(
        sql`(${customers.name} = ${kw}
          OR ${customers.name} ILIKE ${kw + '%'}
          OR ${customers.name} ILIKE ${'%' + kw + '%'}
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
    return { ...customer, contacts: contactList }
  }

  // 维护（§8.3 assertCanContribute：owner / 管理链 / admin）
  async update(id: string, dto: UpdateCustomerDto, actor: AuthUser) {
    const customer = await this.findVisible(id, actor)
    await this.assertCanContribute(customer, actor)

    const [updated] = await db
      .update(customers)
      .set({
        name: dto.name ?? customer.name,
        normalizedKey: dto.name ? normalizeBusinessName(dto.name) : customer.normalizedKey,
        customerCode: dto.customerCode === undefined ? customer.customerCode : dto.customerCode,
        unifiedSocialCreditCode:
          dto.unifiedSocialCreditCode === undefined
            ? customer.unifiedSocialCreditCode
            : dto.unifiedSocialCreditCode,
        industry: dto.industry === undefined ? customer.industry : dto.industry,
        subIndustry: dto.subIndustry === undefined ? customer.subIndustry : dto.subIndustry,
        customerType: dto.customerType === undefined ? customer.customerType : dto.customerType,
        city: dto.city === undefined ? customer.city : dto.city,
        province: dto.province === undefined ? customer.province : dto.province,
        address: dto.address === undefined ? customer.address : dto.address,
        website: dto.website === undefined ? customer.website : dto.website,
        source: dto.source === undefined ? customer.source : dto.source,
        level: dto.level ?? customer.level,
        notes: dto.notes === undefined ? customer.notes : dto.notes,
        // ownerId 变更走 transfer 专用接口（D 阶段），此处不直接改归属
      })
      .where(eq(customers.id, customer.id))
      .returning()
    return updated
  }

  // ===== 联系人（§7.2）=====

  async addContact(customerId: string, dto: CreateContactDto, actor: AuthUser) {
    const customer = await this.findVisible(customerId, actor)
    await this.assertCanContribute(customer, actor)
    const [created] = await db
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
  }

  async updateContact(contactId: string, dto: CreateContactDto, actor: AuthUser) {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)

    const [updated] = await db
      .update(contacts)
      .set({
        name: dto.name === undefined ? contact.name : dto.name,
        title: dto.title === undefined ? contact.title : dto.title,
        phone: dto.phone === undefined ? contact.phone : dto.phone,
        isKeyContact: dto.isKeyContact ?? contact.isKeyContact,
      })
      .where(eq(contacts.id, contactId))
      .returning()
    return updated
  }

  async removeContact(contactId: string, actor: AuthUser): Promise<void> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
    if (!contact) throw new NotFoundException('联系人不存在')
    const customer = await this.findVisible(contact.customerId, actor)
    await this.assertCanContribute(customer, actor)
    await db.delete(contacts).where(eq(contacts.id, contactId))
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
}

// 应用层约束（§8.2）：联系人至少一个含电话（裸电话场景也算）
function assertContactHasPhone(contactList: CreateContactDto[]): void {
  const hasPhone = contactList.some((c) => c.phone?.trim())
  if (!hasPhone) throw new ForbiddenException('至少需要一个联系人电话')
}

// PostgreSQL 唯一约束冲突（SQLSTATE 23505）：查重硬拦截判定
// Drizzle 0.45+ 包装为 DrizzleQueryError，底层 pg 错误在 cause 上
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code === '23505' || err.cause?.code === '23505'
}
