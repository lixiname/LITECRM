import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { JwtPayload } from './auth.service'

// PEP（策略执行点）：校验 access token，注入当前用户（§6.1）
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const auth = req.headers.authorization as string | undefined
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) throw new UnauthorizedException('未登录')

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token)
      if (payload.type !== 'access') throw new UnauthorizedException('token 类型错误')
      req.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tv }
      return true
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录')
    }
  }
}
