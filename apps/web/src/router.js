import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './stores/auth'
import { useWorkspacePanel } from './composables/useWorkspacePanel'

const routes = [
  { path: '/', component: () => import('./views/Login.vue'), meta: { bare: true, gate: true } },
  { path: '/login', redirect: '/' },
  { path: '/admin', component: () => import('./views/Admin.vue'), meta: { auth: true, admin: true } },
  { path: '/library', component: () => import('./views/Workspace.vue'), meta: { auth: true } },
  { path: '/files', redirect: '/library' },
  {
    path: '/ask',
    redirect: () => {
      useWorkspacePanel().setPanel('ask')
      return '/library'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuth()
  if (!auth.loaded) await auth.refresh()
  if (auth.user && to.meta.gate) return { path: '/library' }
  if (to.meta.auth && !auth.user) return { path: '/' }
  if (to.meta.admin && !auth.user?.isAdmin) return { path: '/library' }
  return true
})

export default router
