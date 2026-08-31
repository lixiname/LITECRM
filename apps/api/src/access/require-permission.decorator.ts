import { SetMetadata } from '@nestjs/common'
import type { Ability } from '../common/constants'

export const REQUIRE_PERMISSION_KEY = 'require_permission'
export const REQUIRE_ANY_PERMISSION_KEY = 'require_any_permission'

// 声明接口所需能力点：@RequirePermission('user.manage')
export const RequirePermission = (...abilities: Ability[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, abilities)

// 声明接口满足任一能力即可访问：@RequireAnyPermission('dashboard.view', 'stats.view')
export const RequireAnyPermission = (...abilities: Ability[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, abilities)
