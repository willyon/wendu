<template>
  <div class="langs" role="group">
    <button type="button" :class="{ on: locale === 'zh' }" @click="setLocale('zh')">
      {{ t('langZh') }}
    </button>
    <span class="sep" aria-hidden="true">/</span>
    <button type="button" :class="{ on: locale === 'en' }" @click="setLocale('en')">
      {{ t('langEn') }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { setLocale } from '../i18n'

const { t, locale } = useI18n()
</script>

<style scoped>
.langs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
button {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--muted);
  cursor: pointer;
}
button.on {
  color: var(--ink);
}
.sep {
  color: var(--line);
  user-select: none;
}
</style>
