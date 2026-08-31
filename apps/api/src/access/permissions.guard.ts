import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Ability, Role } from '../common/constants'
import { AccessService } from './access.service'
import { REQUIRE_ANY_PERMISSION_KEY, REQUIRE_PERMISSION_KEY } from './require-permission.decorator'

// PEP（策略执行点）：校验当前用户是否具备接口要求的能力点（§6.1：RBAC 管操作）
// 配合 JwtAuthGuard 使用：先登录（req.user 注入），再查能力点
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly accessService: AccessService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Ability[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    const requiredAny = this.reflector.getAllAndOverride<Ability[] | undefined>(
      REQUIRE_ANY_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if ((!required || required.length === 0) && (!requiredAny || requiredAny.length === 0)) {
      return true
    }

    const user = context.switchToHttp().getRequest().user as { id: string; role: Role } | undefined
    if (!user) throw new UnauthorizedException('未登录')

    const hasAll =
      !required ||
      required.length === 0 ||
      required.every((ability) => this.accessService.can(user.role, ability))
    if (!hasAll) throw new ForbiddenException('无此操作权限')
    const hasAny =
      !requiredAny ||
      requiredAny.length === 0 ||
      requiredAny.some((ability) => this.accessService.can(user.role, ability))
    if (!hasAny) throw new ForbiddenException('无此操作权限')
    return true
  }
}
