import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type Ability } from '@crm/domain'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    requiresAbility?: Ability
  }
}

// 路由：登录页 + 首页（M1 打通）；业务路由随模块推进（规格 §5）
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/WeekViewPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mine',
      name: 'mine',
      component: () => import('@/pages/MinePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('@/pages/CustomersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quick-add',
      name: 'quick-add',
      component: () => import('@/pages/QuickAddPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('@/pages/ExpensesPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/records/:type/:id',
      name: 'actual-record-detail',
      component: () => import('@/pages/ActualRecordDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/customers/:id',
      name: 'customer-detail',
      component: () => import('@/pages/CustomerDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/customers/:id/visit/new',
      name: 'visit-new',
      component: () => import('@/pages/VisitFormPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/customers/:id/opportunity/new',
      name: 'opportunity-new',
      component: () => import('@/pages/OpportunityFormPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/customers/:id/complaint/new',
      name: 'complaint-new',
      component: () => import('@/pages/ComplaintFormPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/opportunities/:id/follow-up',
      name: 'opportunity-follow-up',
      component: () => import('@/pages/OpportunityFollowUpPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/opportunities/:id',
      name: 'opportunity-detail',
      component: () => import('@/pages/OpportunityDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/complaints/:id',
      name: 'complaint-detail',
      component: () => import('@/pages/ComplaintDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/complaints/:id/follow-up',
      name: 'complaint-follow-up',
      component: () => import('@/pages/ComplaintFollowUpPage.vue'),
      meta: { requiresAuth: true, requiresAbility: 'customer.write' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { guestOnly: true },
    },
  ],
})

// 登录守卫（§8.1）：未登录访问受保护页 → /login；已登录访问 /login → 首页
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' }
  if (to.meta.guestOnly && auth.isLoggedIn) return { name: 'home' }
  if (to.meta.requiresAbility && !auth.hasAbility(to.meta.requiresAbility)) return { name: 'home' }
  return true
})

export default router
