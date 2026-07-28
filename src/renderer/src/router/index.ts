import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import WelcomePage from '@/pages/welcome/index.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/welcome' },
  { path: '/welcome', name: 'welcome', component: WelcomePage },
  { path: '/setup', name: 'setup', component: () => import('@/pages/setup/index.vue') },
  { path: '/config', name: 'config', component: () => import('@/pages/setup/config.vue') },
  { path: '/done', name: 'done', component: () => import('@/pages/dashboard/done.vue') },
  { path: '/dashboard/troubleshoot', name: 'troubleshoot', component: () => import('@/pages/dashboard/troubleshoot.vue') }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
