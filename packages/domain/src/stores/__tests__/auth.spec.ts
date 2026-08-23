import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth'
import { apiGet, ApiError, setSessionExpiredHandler, setTokens } from '../../services/http'

const mockFetch = vi.fn()
const STORAGE_KEY = 'crm.auth'

function loginResponse() {
  return {
    user: { id: 'u1', username: 'zhang', displayName: '张三', role: 'sales' },
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    capabilities: ['customer.write', 'customer.transfer'],
    dataScope: 'self',
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  localStorage.clear()
  setTokens(null, null)
  setSessionExpiredHandler(null)
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth store（§8.1 登录会话）', () => {
  it('登录成功：会话状态 + 权限快照 + 本地持久化', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(loginResponse()))
    const store = useAuthStore()

    await store.login('zhang', 'pw123456')

    expect(store.isLoggedIn).toBe(true)
    expect(store.user?.displayName).toBe('张三')
    expect(store.user?.role).toBe('sales')
    expect(store.hasAbility('customer.write')).toBe(true)
    expect(store.hasAbility('user.manage')).toBe(false)
    expect(store.dataScope).toBe('self')

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(saved.accessToken).toBe('access-1')
    expect(saved.capabilities).toContain('customer.write')
  })

  it('登录失败：抛出 ApiError 且状态保持未登录', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ statusCode: 401, message: '账号或密码错误', error: 'Unauthorized' }, 401),
    )
    const store = useAuthStore()

    await expect(store.login('zhang', 'wrong')).rejects.toThrow('账号或密码错误')
    expect(store.isLoggedIn).toBe(false)
  })

  it('restoreSession：从 localStorage 恢复会话', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: { id: 'u1', username: 'zhang', displayName: '张三', role: 'sales' },
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        capabilities: ['customer.write'],
        dataScope: 'self',
      }),
    )
    const store = useAuthStore()
    store.restoreSession()

    expect(store.isLoggedIn).toBe(true)
    expect(store.accessToken).toBe('access-1')
  })

  it('restoreSession：无持久化数据时保持未登录', () => {
    const store = useAuthStore()
    store.restoreSession()
    expect(store.isLoggedIn).toBe(false)
  })

  it('logout：清空内存与本地持久化', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(loginResponse()))
    const store = useAuthStore()
    await store.login('zhang', 'pw123456')
    expect(store.isLoggedIn).toBe(true)

    store.logout()

    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('会话失效（refresh 失败）→ 自动清空登录态', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(loginResponse()))
    const store = useAuthStore()
    await store.login('zhang', 'pw123456')
    expect(store.isLoggedIn).toBe(true)

    // 后续请求 401 + refresh 失败 → 触发 onSessionExpired → store.clear()
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(apiGet('/users')).rejects.toThrow(ApiError)
    expect(store.isLoggedIn).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
