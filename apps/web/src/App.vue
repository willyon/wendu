<template>
  <div class="shell" :class="{ bare: isBare }">
    <AppHeader v-if="!isBare" />
    <main>
      <router-view />
    </main>
    <AppToast />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'

const route = useRoute()
const isBare = computed(() => route.meta.bare === true)
</script>

<style>
:root {
  --ink: #1c2420;
  --muted: #5a655e;
  --line: #d4dbd5;
  --line-workspace: #e5e8e5;
  --accent: #2c4a3a;
  --accent-hover: #243d31;
  --error: #ef4444;
  --success: #67c23a;
  --paper-entry: #eef1ec;
  --paper-workspace: #fafafa;
  --paper: var(--paper-entry);
  --surface: rgba(255, 255, 255, 0.55);
  --font-brand: 'Noto Serif SC', 'Source Serif 4', serif;
  --font-body: 'IBM Plex Sans', 'Helvetica Neue', sans-serif;
  --page-pad-x: clamp(16px, 4vw, 48px);
  --page-pad-y: clamp(20px, 3vw, 40px);
  --scroll-track: transparent;
  --scroll-thumb: color-mix(in srgb, var(--muted) 28%, var(--line));
  --scroll-thumb-hover: color-mix(in srgb, var(--muted) 42%, var(--line));
}

html {
  -webkit-text-size-adjust: 100%;
}

html,
body,
#app {
  margin: 0;
  min-height: 100%;
  width: 100%;
  overflow-x: hidden;
  color: var(--ink);
  font-family: var(--font-body);
  background-color: var(--paper-entry);
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.17 0 0 0 0 0.29 0 0 0 0 0.23 0 0 0 0.045 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(ellipse 85% 55% at 8% 0%, rgba(44, 74, 58, 0.14), transparent 58%),
    radial-gradient(ellipse 70% 48% at 96% 4%, rgba(90, 101, 94, 0.1), transparent 52%),
    radial-gradient(ellipse 55% 40% at 70% 100%, rgba(44, 74, 58, 0.06), transparent 55%),
    linear-gradient(165deg, #f6f8f4 0%, #eef1ec 42%, #e6eae3 100%);
  background-attachment: fixed;
}

.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.shell:not(.bare) {
  --paper: var(--paper-workspace);
  --line: var(--line-workspace);
  background-color: var(--paper-workspace);
  background-image: none;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}

.shell:not(.bare) main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.shell.bare main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

a {
  color: var(--accent);
}

.wendu-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--scroll-thumb) var(--scroll-track);
}
.wendu-scroll::-webkit-scrollbar {
  width: 6px;
}
.wendu-scroll::-webkit-scrollbar-track {
  background: var(--scroll-track);
}
.wendu-scroll::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb);
  border-radius: 999px;
}
.wendu-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--scroll-thumb-hover);
}
</style>
