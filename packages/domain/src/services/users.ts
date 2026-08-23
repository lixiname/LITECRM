import type { components } from '@crm/contracts'
import { apiDelete, apiGet, apiPatch, apiPost } from './http'

export type User = components['schemas']['UserDto']
export type CreateUserInput = components['schemas']['CreateUserDto']
export type UpdateUserInput = components['schemas']['UpdateUserDto']

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
export function deactivateUser(id: string): Promise<void> {
  return apiDelete<void>(`/users/${id}`)
}

/** 重置密码：返回临时密码（仅此一次展示） */
export function resetUserPassword(id: string): Promise<string> {
  return apiPost<string>(`/users/${id}/reset-password`)
}
