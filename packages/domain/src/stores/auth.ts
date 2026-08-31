import { defineStore } from 'pinia'
import type { components } from '@crm/contracts'
import {
  changePassword as changePasswordApi,
  login as loginApi,
  type LoginResponse,
} from '../services/auth'
import { setSessionExpiredHandler, setTokens } from '../services/http'

export type Ability = components['schemas']['Ability']
export type DataScope = components['schemas']['DataScope']

// 会话本地持久化 key（access 2h + refresh 14d，刷新由 http client 自动处理）
const STORAGE_KEY = 'crm.auth'

export interface AuthState {
  user: LoginResponse['user'] | null
  accessToken: string | null
  refreshToken: string | null
  capabilities: Ability[]
  dataScope: DataScope | null
}

/**
 * 登录会话 store（§8.1）：
 * - 登录/登出/恢复会话/改密
 * - 令牌注入 http client（自动 Bearer + 401 自动刷新）
 * - 会话失效（refresh 失败）→ 清空并触发路由跳登录
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    capabilities: [],
    dataScope: null,
  }),

  getters: {
    isLoggedIn: (s) => Boolean(s.accessToken && s.user),
    displayName: (s) => s.user?.displayName ?? '',
    hasAbility:
      (s) =>
      (ability: Ability): boolean =>
        s.capabilities.includes(ability),
    hasAnyAbility:
      (s) =>
      (abilities: Ability[]): boolean =>
        abilities.some((ability) => s.capabilities.includes(ability)),
  },

  actions: {
    /** 登录（§8.1）：服务端校验 → 落库会话 → 持久化 → 绑定失效回调 */
    async login(username: string, password: string) {
      const res = await loginApi(username, password)
      this.applySession(res)
    },

    /** 应用启动时恢复会话（过期由 http 401 自动刷新兜底，刷新失败才清会话） */
    restoreSession() {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        const saved = JSON.parse(raw) as AuthState
        if (!saved.accessToken) return this.clear()
        this.user = saved.user
        this.accessToken = saved.accessToken
        this.refreshToken = saved.refreshToken
        this.capabilities = saved.capabilities ?? []
        this.dataScope = saved.dataScope ?? null
        this.bindSession()
      } catch {
        this.clear()
      }
    },

    /** 登出：清内存 + 本地存储 + http 令牌（服务端无撤销，靠 token_version 兜底） */
    logout() {
      this.clear()
    },

    /** 本人改密：改密后 token 全端失效（§6.5），清会话跳登录 */
    async changePassword(oldPassword: string, newPassword: string) {
      await changePasswordApi(oldPassword, newPassword)
      this.clear()
    },

    applySession(res: LoginResponse) {
      this.user = res.user
      this.accessToken = res.accessToken
      this.refreshToken = res.refreshToken
      this.capabilities = res.capabilities
      this.dataScope = res.dataScope
      this.persist()
      this.bindSession()
    },

    persist() {
      const snapshot: AuthState = {
        user: this.user,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        capabilities: this.capabilities,
        dataScope: this.dataScope,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    },

    bindSession() {
      setTokens(this.accessToken, this.refreshToken)
      setSessionExpiredHandler(() => this.clear())
    },

    clear() {
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      this.capabilities = []
      this.dataScope = null
      setTokens(null, null)
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
