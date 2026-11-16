import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { session } from './lib/session'
import TabsPage from './views/TabsPage.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/capture' },
  { path: '/sign-in', component: () => import('./views/SignInPage.vue'), meta: { public: true } },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      { path: '', redirect: '/tabs/capture' },
      { path: 'capture', component: () => import('./views/CapturePage.vue') },
      { path: 'inbox', component: () => import('./views/InboxPage.vue') },
      { path: 'today', component: () => import('./views/TodayPage.vue') },
      { path: 'library', component: () => import('./views/LibraryPage.vue') },
    ],
  },
  { path: '/item/:id', component: () => import('./views/ItemPage.vue'), props: true },
  { path: '/review', component: () => import('./views/ReviewPage.vue') },
  { path: '/settings', component: () => import('./views/settings/SettingsPage.vue') },
  { path: '/settings/account', component: () => import('./views/settings/AccountPage.vue') },
  { path: '/settings/region', component: () => import('./views/settings/RegionPage.vue') },
  { path: '/settings/reminders', component: () => import('./views/settings/RemindersPage.vue') },
  {
    path: '/settings/notifications',
    component: () => import('./views/settings/NotificationsPage.vue'),
  },
  { path: '/settings/devices', component: () => import('./views/settings/DevicesPage.vue') },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  if (!session.token && !to.meta.public) return '/sign-in'
  if (session.token && to.path === '/sign-in') return '/tabs/capture'
})
