import { SetMetadata } from '@nestjs/common'
import type { Ability } from '../common/constants'

export const REQUIRE_PERMISSION_KEY = 'require_permission'

// 声明接口所需能力点：@RequirePermission('user.manage')
export const RequirePermission = (...abilities: Ability[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, abilities)
