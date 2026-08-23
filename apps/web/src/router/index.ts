import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type Ability } from '@crm/domain'

// 路由 meta 类型：requiresAbility 声明该页所需能力点（守卫按权限快照裁决）
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAbility?: Ability
    guestOnly?: boolean
  }
}

// 路由：登录页 + 首页 + 用户管理（M1 权限闭环）；业务路由随模块推进（规格 §5）
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/pages/UsersPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'user.manage' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guestOnly: true },
    },
  ],
})

// 登录守卫（§8.1）：未登录访问受保护页 → /login；已登录访问 /login → 首页；
// 能力点守卫（§6.1）：无 user.manage 的账号访问 /users → 首页
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' }
  if (to.meta.requiresAbility && !auth.hasAbility(to.meta.requiresAbility)) return { name: 'home' }
  if (to.meta.guestOnly && auth.isLoggedIn) return { name: 'home' }
  return true
})

export default router
