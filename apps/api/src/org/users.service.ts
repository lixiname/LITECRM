import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db } from '../common/db/db'
import { salesRegions, users } from '../common/db/schema'
import { AuthService } from '../auth/auth.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import type { Role } from '../common/constants'

// 用户管理（§6.2/8.1）：CRUD + 停用 + 重置密码，admin（user.manage）专属
@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {}

  async create(dto: CreateUserDto) {
    await this.assertSalesRegion(dto.salesRegionId)
    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1)
    if (exists) throw new ConflictException('用户名已存在')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const [created] = await db
      .insert(users)
      .values({
        username: dto.username,
        passwordHash,
        displayName: dto.displayName,
        role: dto.role,
        reportsToId: dto.reportsToId ?? null,
        phone: dto.phone ?? null,
        salesRegionId: dto.salesRegionId ?? null,
      })
      .returning()
    return this.findOne(created.id)
  }

  async findAll() {
    const all = await this.userQuery()
    return all.map(toUserDto)
  }

  async findOne(id: string) {
    const [user] = await this.userQuery().where(eq(users.id, id)).limit(1)
    if (!user) throw new NotFoundException('用户不存在')
    return toUserDto(user)
  }

  async update(id: string, dto: UpdateUserDto) {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing) throw new NotFoundException('用户不存在')
    if (existing.version !== dto.version) throw new ConflictException('用户已被更新，请刷新后重试')
    await this.assertSalesRegion(dto.salesRegionId ?? undefined)

    const [updated] = await db
      .update(users)
      .set({
        displayName: dto.displayName ?? existing.displayName,
        role: dto.role ?? existing.role,
        reportsToId: dto.reportsToId === undefined ? existing.reportsToId : dto.reportsToId,
        phone: dto.phone === undefined ? existing.phone : dto.phone,
        salesRegionId: dto.salesRegionId === undefined ? existing.salesRegionId : dto.salesRegionId,
        isActive: dto.isActive ?? existing.isActive,
        updatedAt: new Date(),
        version: sql`${users.version} + 1`,
      })
      .where(and(eq(users.id, id), eq(users.version, dto.version)))
      .returning()
    if (!updated) throw new ConflictException('用户已被更新，请刷新后重试')
    return this.findOne(updated.id)
  }

  // 停用：isActive=false + tokenVersion+1 全端失效（§6.5）
  async deactivate(id: string, version: number): Promise<void> {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing) throw new NotFoundException('用户不存在')
    if (existing.version !== version) throw new ConflictException('用户已被更新，请刷新后重试')
    const [updated] = await db
      .update(users)
      .set({
        isActive: false,
        tokenVersion: existing.tokenVersion + 1,
        updatedAt: new Date(),
        version: sql`${users.version} + 1`,
      })
      .where(and(eq(users.id, id), eq(users.version, version)))
      .returning({ id: users.id })
    if (!updated) throw new ConflictException('用户已被更新，请刷新后重试')
  }

  // 重置密码：复用 auth 服务（生成临时密码 + 全端失效）
  async resetPassword(id: string): Promise<string> {
    return this.authService.resetPassword(id)
  }

  private userQuery() {
    return db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        phone: users.phone,
        reportsToId: users.reportsToId,
        salesRegionId: users.salesRegionId,
        salesRegionName: salesRegions.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
        version: users.version,
      })
      .from(users)
      .leftJoin(salesRegions, eq(users.salesRegionId, salesRegions.id))
  }

  private async assertSalesRegion(salesRegionId?: string) {
    if (!salesRegionId) return
    const [match] = await db
      .select({ id: salesRegions.id })
      .from(salesRegions)
      .where(and(eq(salesRegions.isActive, true), eq(salesRegions.id, salesRegionId)))
      .limit(1)
    if (!match) throw new BadRequestException('请选择有效的人员所属销售大区')
  }
}

// 输出裁剪：剔除 passwordHash（db 行 → 安全 DTO）
type UserRow = Pick<
  typeof users.$inferSelect,
  | 'id'
  | 'username'
  | 'displayName'
  | 'role'
  | 'phone'
  | 'reportsToId'
  | 'salesRegionId'
  | 'isActive'
  | 'createdAt'
  | 'version'
> & { salesRegionName: string | null }

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role as Role,
    phone: u.phone,
    reportsToId: u.reportsToId,
    salesRegionId: u.salesRegionId,
    salesRegionName: u.salesRegionName,
    isActive: u.isActive,
    createdAt: u.createdAt,
    version: u.version,
  }
}
