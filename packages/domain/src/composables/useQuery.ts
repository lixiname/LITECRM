import { ref, type Ref } from 'vue'

export interface UseQueryOptions {
  /** 是否创建即加载（默认 true） */
  immediate?: boolean
}

export interface UseQueryResult<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  /** 重新请求 */
  reload: () => Promise<void>
  /** 本地覆盖数据（写操作后免整页刷新，规格 §5.3） */
  setData: (next: T | null) => void
}

/**
 * 轻量数据获取封装（规格 §5.3：接口对齐 TanStack Query 的 useQuery 形态）。
 * key 用于标识与缓存键预留；data/loading/error/reload/setData 五个出口。
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  void key // 缓存/失效策略预留
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { immediate = true } = options

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      data.value = await fetcher()
    } catch (e) {
      data.value = null
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  function setData(next: T | null): void {
    data.value = next
  }

  if (immediate) void load()

  return { data, loading, error, reload: load, setData }
}
