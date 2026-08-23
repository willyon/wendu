import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

const KEY = 'wendu_lang'
const supported = ['zh', 'en']

function detect() {
  const stored = localStorage.getItem(KEY)
  if (supported.includes(stored)) return stored
  const nav = (navigator.language || 'zh').toLowerCase()
  return nav.startsWith('zh') ? 'zh' : 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detect(),
  fallbackLocale: 'zh',
  messages: { zh, en }
})

export function setLocale(lang) {
  if (!supported.includes(lang)) return
  i18n.global.locale.value = lang
  localStorage.setItem(KEY, lang)
  document.title = i18n.global.t('brand')
}

setLocale(i18n.global.locale.value)

export default i18n
