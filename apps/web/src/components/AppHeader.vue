<template>
  <header class="bar">
    <router-link to="/library" class="brand" @click="setPanel('library')">{{ t('brand') }}</router-link>
    <nav v-if="showNav" class="nav" :class="{ 'nav--admin': isAdminPage }">
      <button
        v-if="isAdminPage"
        type="button"
        class="nav-btn"
        @click="goWorkspace"
      >
        {{ t('workspace') }}
      </button>
      <template v-else>
        <button
          type="button"
          class="nav-btn"
          :class="{ active: isLibraryPanel }"
          @click="goLibrary"
        >
          {{ t('files') }}
        </button>
        <button
          type="button"
          class="nav-btn"
          :class="{ active: isAskPanel }"
          @click="goAsk"
        >
          {{ t('ask') }}
        </button>
      </template>
    </nav>
    <div class="right">
      <UserMenu />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWorkspacePanel } from '../composables/useWorkspacePanel'
import UserMenu from './UserMenu.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { panel, setPanel } = useWorkspacePanel()

const isAdminPage = computed(() => route.path === '/admin')
const isWorkspacePage = computed(() => route.path === '/library')
const showNav = computed(() => isWorkspacePage.value || isAdminPage.value)
const isLibraryPanel = computed(() => panel.value === 'library')
const isAskPanel = computed(() => panel.value === 'ask')

function goWorkspace() {
  router.push('/library')
}

function goLibrary() {
  setPanel('library')
}

function goAsk() {
  setPanel('ask')
}
</script>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 28px;
  width: 100%;
  box-sizing: border-box;
  padding: 14px var(--page-pad-x);
  border-bottom: 1px solid var(--line);
  background: var(--paper-workspace);
}
.brand {
  font-family: var(--font-brand);
  font-size: clamp(18px, 4vw, 22px);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink);
  text-decoration: none;
}
.nav {
  display: flex;
  gap: clamp(18px, 3vw, 32px);
}
@media (min-width: 960px) {
  .nav:not(.nav--admin) {
    display: none;
  }
}
.nav-btn {
  position: relative;
  border: none;
  background: none;
  padding: 4px 0;
  font: inherit;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--muted);
  cursor: pointer;
}
.nav-btn:hover {
  color: var(--ink);
}
.nav-btn.active {
  color: var(--ink);
}
.nav-btn.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: var(--accent);
  opacity: 0.55;
}
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}
@media (max-width: 520px) {
  .bar {
    gap: 10px 14px;
  }
  .nav {
    order: 3;
    width: 100%;
    padding-top: 4px;
  }
}
</style>
