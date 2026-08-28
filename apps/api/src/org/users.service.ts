import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, or } from 'drizzle-orm'
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
    await this.assertRegion(dto.region)
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
        region: dto.region ?? null,
      })
      .returning()
    return toUserDto(created)
  }

  async findAll() {
    const all = await db.select().from(users)
    return all.map(toUserDto)
  }

  async findOne(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user) throw new NotFoundException('用户不存在')
    return toUserDto(user)
  }

  async update(id: string, dto: UpdateUserDto) {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing) throw new NotFoundException('用户不存在')
    await this.assertRegion(dto.region)

    const [updated] = await db
      .update(users)
      .set({
        displayName: dto.displayName ?? existing.displayName,
        role: dto.role ?? existing.role,
        reportsToId: dto.reportsToId === undefined ? existing.reportsToId : dto.reportsToId,
        phone: dto.phone === undefined ? existing.phone : dto.phone,
        region: dto.region === undefined ? existing.region : dto.region,
        isActive: dto.isActive ?? existing.isActive,
      })
      .where(eq(users.id, id))
      .returning()
    return toUserDto(updated)
  }

  // 停用：isActive=false + tokenVersion+1 全端失效（§6.5）
  async deactivate(id: string): Promise<void> {
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing) throw new NotFoundException('用户不存在')
    await db
      .update(users)
      .set({ isActive: false, tokenVersion: existing.tokenVersion + 1 })
      .where(eq(users.id, id))
  }

  // 重置密码：复用 auth 服务（生成临时密码 + 全端失效）
  async resetPassword(id: string): Promise<string> {
    return this.authService.resetPassword(id)
  }

  private async assertRegion(region?: string) {
    if (!region) return
    const [match] = await db
      .select({ id: salesRegions.id })
      .from(salesRegions)
      .where(
        and(
          eq(salesRegions.isActive, true),
          or(eq(salesRegions.name, region), eq(salesRegions.code, region)),
        ),
      )
      .limit(1)
    if (!match) throw new BadRequestException('请选择有效的销售区域')
  }
}

// 输出裁剪：剔除 passwordHash（db 行 → 安全 DTO）
type UserRow = typeof users.$inferSelect

export function toUserDto(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role as Role,
    phone: u.phone,
    reportsToId: u.reportsToId,
    region: u.region,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }
}
