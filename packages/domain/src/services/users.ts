import type { components } from '@crm/contracts'
import { apiDelete, apiGet, apiPatch, apiPost } from './http'

export type User = components['schemas']['UserDto']
export type CreateUserInput = components['schemas']['CreateUserDto']
export type UpdateUserInput = components['schemas']['UpdateUserDto']
export type ResetUserPasswordInput = components['schemas']['ResetUserPasswordDto']
export type UnlockUserLoginInput = components['schemas']['UnlockUserLoginDto']

// 用户管理（§6.2/8.1）：admin（user.manage）专属，调用方按能力点控制入口
export function listUsers(): Promise<User[]> {
  return apiGet<User[]>('/users')
}

export function getUser(id: string): Promise<User> {
  return apiGet<User>(`/users/${id}`)
}

export function createUser(dto: CreateUserInput): Promise<User> {
  return apiPost<User>('/users', dto)
}

export function updateUser(id: string, dto: UpdateUserInput): Promise<User> {
  return apiPatch<User>(`/users/${id}`, dto)
}

/** 停用：isActive=false + 全端 token 失效 */
export function deactivateUser(id: string, version: number): Promise<void> {
  return apiDelete<void>(`/users/${id}?version=${version}`)
}

/** 管理员设置新密码；同时使旧 token 失效并解除登录锁定。 */
export function resetUserPassword(id: string, dto: ResetUserPasswordInput): Promise<void> {
  return apiPost<void>(`/users/${id}/reset-password`, dto)
}

/** 解除连续登录失败形成的临时锁定。 */
export function unlockUserLogin(id: string, dto: UnlockUserLoginInput): Promise<User> {
  return apiPost<User>(`/users/${id}/unlock-login`, dto)
}
