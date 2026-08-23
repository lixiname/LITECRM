import type { components } from '@crm/contracts'

// http 内部使用的令牌对类型（外部使用 services/auth 的 TokenPair）
type TokenPair = components['schemas']['TokenPairDto']

// 请求错误规范化：统一 message（后端 NestJS 错误体 message 可能是 string 或 string[]）
export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

// ===== 运行时可配置状态（由 auth store 在登录/恢复会话时注入）=====
let baseURL = '/api' // dev 走 vite proxy；prod 同域名 Nginx 反代（规格 §9.2）
let accessToken: string | null = null
let refreshToken: string | null = null
let onSessionExpired: (() => void) | null = null
let refreshing: Promise<boolean> | null = null

/** 配置 baseURL（默认 /api；测试或特殊部署可覆盖） */
export function configureHttp(options: { baseURL?: string }): void {
  if (options.baseURL !== undefined) baseURL = options.baseURL
}

/** 注入/清除令牌（登录、恢复会话、登出时调用） */
export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access
  refreshToken = refresh
}

/** 注册会话失效回调（refresh 失败 → 前端清会话跳登录） */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

// 401 白名单：登录/刷新接口自身不触发自动刷新，避免死循环
function isRetryable(path: string): boolean {
  return path !== '/auth/login' && path !== '/auth/refresh'
}

/** 单飞刷新：并发 401 只发一次 refresh 请求 */
function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing
  if (!refreshToken) return Promise.resolve(false)

  refreshing = (async () => {
    try {
      const res = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as TokenPair
      accessToken = data.accessToken
      refreshToken = data.refreshToken
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined

  if (!res.ok) {
    const raw = data as { message?: string | string[] } | null | undefined
    const message =
      typeof raw?.message === 'string'
        ? raw.message
        : Array.isArray(raw?.message)
          ? raw.message.join('；')
          : `请求失败（HTTP ${res.status}）`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res = await fetch(`${baseURL}${path}`, { ...init, headers })

  // 401 且可重试：自动 refresh 后重放一次（规格 §6.5 无感刷新）
  if (res.status === 401 && isRetryable(path) && refreshToken) {
    const ok = await tryRefresh()
    if (ok && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
      res = await fetch(`${baseURL}${path}`, { ...init, headers })
    } else {
      onSessionExpired?.()
    }
  }

  return parseResponse<T>(res)
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
