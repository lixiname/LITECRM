import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db } from '../common/db/db'
import { users } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import type { Role } from '../common/constants'

const MAX_LOGIN_FAILURES = 5 // §6.5：连续 5 次错误锁定
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 分钟
const ACCESS_TTL = '2h'
const REFRESH_TTL = '14d'

export interface JwtPayload {
  sub: string // userId
  role: Role
  tv: number // tokenVersion：改密/停用使旧 token 失效（§6.5）
  type: 'access' | 'refresh'
}

export interface AuthUser {
  id: string
  role: Role
  tokenVersion: number
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly accessService: AccessService,
  ) {}

  // 登录（§8.1）：防爆破 → bcrypt 校验 → 签发双 token → 权限快照
  async login(username: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1)
    if (!user || !user.isActive) {
      // 统一报错，避免用户名枚举
      throw new UnauthorizedException('账号或密码错误')
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('尝试次数过多，账号已锁定 15 分钟')
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash)
    if (!passwordOk) {
      await this.recordFailure(user.id, user.loginFailedCount)
      throw new UnauthorizedException('账号或密码错误')
    }

    await db
      .update(users)
      .set({ loginFailedCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    const role = user.role as Role // db 层 text → 领域类型
    const tokens = await this.signTokens(user.id, role, user.tokenVersion)
    const snapshot = this.accessService.buildPermissionSnapshot(role)
    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        jobTitle: user.jobTitle,
        role: user.role,
      },
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      capabilities: snapshot.capabilities,
      dataScope: snapshot.dataScope,
    }
  }

  // 本人改密（§8.1）
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) throw new UnauthorizedException('用户不存在')

    const ok = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!ok) throw new ForbiddenException('旧密码错误')

    const hash = await bcrypt.hash(newPassword, 10)
    await db
      .update(users)
      .set({ passwordHash: hash, tokenVersion: user.tokenVersion + 1 })
      .where(eq(users.id, userId))
  }

  // 管理员重置（§8.1）：生成随机临时密码，token_version+1 全端失效
  async resetPassword(userId: string): Promise<string> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) throw new ConflictException('用户不存在')

    const temp = generateTempPassword()
    const hash = await bcrypt.hash(temp, 10)
    await db
      .update(users)
      .set({ passwordHash: hash, tokenVersion: user.tokenVersion + 1 })
      .where(eq(users.id, userId))
    return temp
  }

  // 无感刷新（§6.5：refresh token 换新 access+refresh，滑动续期；token_version 校验兜底）
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken)
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录')
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('token 类型错误')

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    if (!user || !user.isActive) throw new UnauthorizedException('登录已失效，请重新登录')
    if (user.tokenVersion !== payload.tv) throw new UnauthorizedException('登录已失效，请重新登录')

    // 重新签发：access/refresh 均重置 TTL（滑动续期）
    const { access, refresh } = await this.signTokens(user.id, user.role as Role, user.tokenVersion)
    return { accessToken: access, refreshToken: refresh }
  }

  private async recordFailure(userId: string, currentCount: number): Promise<void> {
    const count = currentCount + 1
    const lockedUntil = count >= MAX_LOGIN_FAILURES ? new Date(Date.now() + LOCK_DURATION_MS) : null
    await db.update(users).set({ loginFailedCount: count, lockedUntil }).where(eq(users.id, userId))
  }

  private async signTokens(userId: string, role: Role, tokenVersion: number) {
    const accessPayload: JwtPayload = { sub: userId, role, tv: tokenVersion, type: 'access' }
    const refreshPayload: JwtPayload = { sub: userId, role, tv: tokenVersion, type: 'refresh' }
    const [access, refresh] = await Promise.all([
      this.jwtService.signAsync(accessPayload, { expiresIn: ACCESS_TTL }),
      this.jwtService.signAsync(refreshPayload, { expiresIn: REFRESH_TTL }),
    ])
    return { access, refresh }
  }
}

// 12 位随机临时密码（去易混淆字符 0O1lI）
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
