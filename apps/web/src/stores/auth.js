import { defineStore } from 'pinia'
import { getCurrentUser, logout as logoutApi } from '../http/api'

export const useAuth = defineStore('auth', {
  state: () => ({
    user: null,
    loaded: false
  }),
  actions: {
    async refresh() {
      try {
        this.user = await getCurrentUser()
      } catch {
        this.user = null
      } finally {
        this.loaded = true
      }
    },
    async logout() {
      await logoutApi()
      this.user = null
    }
  }
})
