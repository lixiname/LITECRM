import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, configureHttp, setSessionExpiredHandler, setTokens } from '../http'

const mockFetch = vi.fn()

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  configureHttp({ baseURL: 'http://test.local/api' })
  setTokens(null, null)
  setSessionExpiredHandler(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('http client（§6.5 无感刷新链路）', () => {
  it('携带 Bearer token 发起请求', async () => {
    setTokens('access-1', 'refresh-1')
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const data = await apiGet<{ ok: boolean }>('/users')
    expect(data).toEqual({ ok: true })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://test.local/api/users')
    expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer access-1',
    )
  })

  it('401 时自动 refresh 并重放原请求', async () => {
    setTokens('stale-access', 'refresh-1')
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const data = await apiGet<{ ok: boolean }>('/users')
    expect(data).toEqual({ ok: true })

    const refreshCall = mockFetch.mock.calls[1]
    expect(JSON.parse((refreshCall[1] as RequestInit).body as string)).toEqual({
      refreshToken: 'refresh-1',
    })
    const retryCall = mockFetch.mock.calls[2]
    expect(
      (retryCall[1] as RequestInit & { headers: Record<string, string> }).headers.Authorization,
    ).toBe('Bearer new-access')
  })

  it('refresh 失败时触发会话失效回调（前端登出）', async () => {
    setTokens('stale-access', 'expired-refresh')
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(apiGet('/users')).rejects.toThrow(ApiError)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('NestJS 错误体 message 数组合并为一条', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { statusCode: 400, message: ['字段A错误', '字段B错误'], error: 'Bad Request' },
        400,
      ),
    )
    await expect(apiGet('/users')).rejects.toThrow('字段A错误；字段B错误')
  })

  it('并发 401 只触发一次 refresh（单飞）', async () => {
    setTokens('stale-access', 'refresh-1')
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /a 首次
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // /b 首次
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      )
      .mockResolvedValueOnce(jsonResponse({ a: 1 })) // /a 重放
      .mockResolvedValueOnce(jsonResponse({ b: 2 })) // /b 重放

    const [r1, r2] = await Promise.all([apiGet<{ a: number }>('/a'), apiGet<{ b: number }>('/b')])
    expect(r1).toEqual({ a: 1 })
    expect(r2).toEqual({ b: 2 })

    const refreshCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/auth/refresh'),
    )
    expect(refreshCalls).toHaveLength(1)
  })
})
