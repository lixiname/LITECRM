import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@crm/domain'

// 路由：登录页 + 首页（M1 打通）；业务路由随模块推进（规格 §5）
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
      path: '/customers',
      name: 'customers',
      component: () => import('@/pages/CustomersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/expenses',
      name: 'expenses',
      component: () => import('@/pages/ExpensesPage.vue'),
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
  return true
})

export default router
