import type { components } from '@crm/contracts'
import { apiPost } from './http'

export type AuthUser = components['schemas']['AuthUserDto']
export type LoginResponse = components['schemas']['LoginResponseDto']
export type TokenPair = components['schemas']['TokenPairDto']

/** 账号密码登录（§8.1）：返回 user + 双 token + 权限快照 */
export function login(username: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { username, password })
}

/** 无感刷新（§6.5）：http client 内部自动调用，也可显式调用 */
export function refreshToken(token: string): Promise<TokenPair> {
  return apiPost<TokenPair>('/auth/refresh', { refreshToken: token })
}

/** 本人改密（§8.1）：成功后全端 token 失效（需重新登录） */
export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return apiPost<void>('/auth/change-password', { oldPassword, newPassword })
}
