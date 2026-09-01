import { describe, expect, it } from 'vitest'
import { useQuery } from './useQuery'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useQuery', () => {
  it('只接收最后一次请求结果，较慢的旧请求不能覆盖当前筛选', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    let requestCount = 0
    const query = useQuery(
      'customer-list',
      () => (requestCount++ === 0 ? first.promise : second.promise),
      { immediate: false },
    )

    const firstReload = query.reload()
    const secondReload = query.reload()

    second.resolve('公海客户')
    await secondReload
    expect(query.data.value).toBe('公海客户')
    expect(query.loading.value).toBe(false)

    first.resolve('在案客户')
    await firstReload
    expect(query.data.value).toBe('公海客户')
    expect(query.error.value).toBeNull()
  })

  it('忽略旧请求在新请求成功后返回的错误', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    let requestCount = 0
    const query = useQuery(
      'customer-list',
      () => (requestCount++ === 0 ? first.promise : second.promise),
      { immediate: false },
    )

    const firstReload = query.reload()
    const secondReload = query.reload()
    second.resolve('无效档案')
    await secondReload

    first.reject(new Error('旧请求失败'))
    await firstReload
    expect(query.data.value).toBe('无效档案')
    expect(query.error.value).toBeNull()
  })
})
