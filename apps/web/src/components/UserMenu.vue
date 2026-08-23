<template>
  <div
    ref="root"
    class="user-menu"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <span class="avatar" :aria-expanded="open" aria-haspopup="menu" role="button" tabindex="0">
      {{ initial }}
    </span>

    <Transition name="menu-fade">
      <div v-show="open" class="menu" role="menu">
        <p class="menu-user">{{ auth.user?.email }}</p>
        <div class="menu-lang">
          <LangSwitch />
        </div>
        <router-link
          v-if="auth.user?.isAdmin"
          to="/admin"
          class="menu-item"
          role="menuitem"
          @click="close"
        >
          <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"
            />
          </svg>
          <span>{{ t('admin') }}</span>
        </router-link>
        <button type="button" class="menu-item" role="menuitem" @click="onLogout">
          <svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
            />
          </svg>
          <span>{{ t('logout') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'
import LangSwitch from './LangSwitch.vue'

const SHOW_DELAY = 100
const HIDE_DELAY = 180

const { t } = useI18n()
const auth = useAuth()
const router = useRouter()

const root = ref(null)
const open = ref(false)
let showTimer = null
let hideTimer = null

const initial = computed(() => {
  const name = auth.user?.email || ''
  return (name.charAt(0) || 'U').toUpperCase()
})

function onEnter() {
  clearTimeout(hideTimer)
  hideTimer = null
  if (open.value) return
  showTimer = setTimeout(() => {
    open.value = true
  }, SHOW_DELAY)
}

function onLeave() {
  clearTimeout(showTimer)
  showTimer = null
  hideTimer = setTimeout(() => {
    open.value = false
  }, HIDE_DELAY)
}

function close() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  open.value = false
}

async function onLogout() {
  close()
  await auth.logout()
  router.push('/')
}

onUnmounted(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
})
</script>

<style scoped>
.user-menu {
  position: relative;
  cursor: pointer;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 72%, var(--muted));
  color: #f7f9f6;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition: background 0.15s ease;
}
.user-menu:hover .avatar {
  background: var(--accent);
}
.menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  min-width: 200px;
  padding: 0 0 6px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--line) 85%, transparent);
  border-radius: 4px;
  box-shadow:
    0 4px 16px color-mix(in srgb, var(--ink) 6%, transparent),
    0 1px 3px color-mix(in srgb, var(--ink) 4%, transparent);
}
.menu::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
}
.menu-user {
  margin: 0;
  padding: 12px 16px 10px;
  font-size: 13px;
  color: var(--muted);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
.menu-lang {
  padding: 10px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
}
.menu-lang :deep(.langs) {
  font-size: 13px;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 16px;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover {
  background: #f5f5f5;
  color: var(--ink);
}
.menu-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--muted);
}
.menu-item:hover .menu-icon {
  color: var(--ink);
}
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
