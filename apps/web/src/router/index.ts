import { createRouter, createWebHistory } from 'vue-router'

// M0 骨架：仅占位首页；业务路由随模块推进（规格 §5）
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
  ],
})

export default router
