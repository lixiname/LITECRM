import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type Ability } from '@crm/domain'

// 路由 meta 类型：requiresAbility 声明该页所需能力点（守卫按权限快照裁决）
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAbility?: Ability
    guestOnly?: boolean
    title?: string
  }
}

// 路由（§5.5 应用外壳）：业务页嵌套于 AppLayout（侧边栏）；登录落地 /customers
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/customers' },
        {
          path: 'customers',
          name: 'customers',
          component: () => import('@/pages/CustomersPage.vue'),
          meta: { title: '客户管理' },
        },
        {
          path: 'customers/new',
          name: 'customer-new',
          component: () => import('@/pages/CreateCustomerPage.vue'),
          meta: { title: '新建客户', requiresAbility: 'customer.write' },
        },
        {
          path: 'customers/:id',
          name: 'customer-detail',
          component: () => import('@/pages/CustomerDetailPage.vue'),
          meta: { title: '客户详情' },
        },
        {
          path: 'opportunities',
          name: 'opportunities',
          component: () => import('@/pages/OpportunitiesPage.vue'),
          meta: { title: '商机管理' },
        },
        {
          path: 'opportunities/:id',
          name: 'opportunity-detail',
          component: () => import('@/pages/OpportunityDetailPage.vue'),
          meta: { title: '商机详情' },
        },
        {
          path: 'complaints',
          name: 'complaints',
          component: () => import('@/pages/ComplaintsPage.vue'),
          meta: { title: '客诉管理' },
        },
        {
          path: 'complaints/:id',
          name: 'complaint-detail',
          component: () => import('@/pages/ComplaintDetailPage.vue'),
          meta: { title: '客诉详情' },
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('@/pages/ExpensesPage.vue'),
          meta: { title: '费用管理' },
        },
        {
          path: 'week-view',
          name: 'week-view',
          component: () => import('@/pages/WeekViewPage.vue'),
          meta: { title: '行动周视图' },
        },
        {
          path: 'claims',
          name: 'claims',
          component: () => import('@/pages/ClaimsPage.vue'),
          meta: { title: '接管审批', requiresAbility: 'approve.claim' },
        },
        {
          path: 'catalog',
          name: 'catalog',
          component: () => import('@/pages/CatalogPage.vue'),
          meta: { title: '字典配置', requiresAbility: 'user.manage' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/pages/UsersPage.vue'),
          meta: { title: '用户管理', requiresAbility: 'user.manage' },
        },
      ],
    },
  ],
})

// 登录守卫（§8.1）：未登录访问受保护页 → /login；已登录访问 /login → 客户列表；
// 能力点守卫（§6.1）：无对应能力 → 客户列表
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' }
  if (to.meta.requiresAbility && !auth.hasAbility(to.meta.requiresAbility))
    return { name: 'customers' }
  if (to.meta.guestOnly && auth.isLoggedIn) return { name: 'customers' }
  return true
})

export default router
