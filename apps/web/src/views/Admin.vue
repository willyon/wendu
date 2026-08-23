<template>
  <div class="admin">
    <div class="admin-inner">
      <nav class="admin-tabs" aria-label="admin sections">
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="tab"
          :class="{ active: section === item.id }"
          @click="section = item.id"
        >
          {{ t(item.label) }}
        </button>
      </nav>

      <div class="admin-main">
        <!-- 账户 -->
        <section v-show="section === 'account'" class="section">
          <h2 class="section-title">{{ t('adminChangePassword') }}</h2>
          <form class="fields fields--aligned" novalidate @submit.prevent="saveMyPassword">
            <label class="field">
              <span class="field-name field-name--required">{{ t('newPassword') }}</span>
              <input
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('adminPasswordHint')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">{{ t('confirmPassword') }}</span>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('confirmPasswordPlaceholder')"
              />
            </label>
            <div class="section-foot">
              <button type="submit" class="cta" :disabled="loadingPw">{{ t('adminSave') }}</button>
            </div>
          </form>
        </section>

        <!-- 模型 -->
        <section v-show="section === 'model'" class="section">
          <p class="section-lead section-lead--model">{{ t('adminModelIntro') }}</p>

          <details class="model-guide">
            <summary class="model-guide-toggle">{{ t('adminModelGuideToggle') }}</summary>
            <ol class="model-guide-steps">
              <li>{{ t('adminModelGuideStep1') }}</li>
              <li>{{ t('adminModelGuideStep2') }}</li>
              <li>{{ t('adminModelGuideStep3') }}</li>
            </ol>
          </details>

          <form class="fields fields--aligned fields--model" novalidate @submit.prevent="saveSettings">
            <label class="field">
              <span class="field-name field-name--required">
                {{ t('adminApiKey') }}
                <FieldInfoHint :text="t('adminApiKeyHint')" />
              </span>
              <input
                v-model="settings.apiKey"
                type="text"
                spellcheck="false"
                autocomplete="off"
                :placeholder="t('adminApiKeyPlaceholder')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">
                {{ t('adminBaseUrl') }}
                <FieldInfoHint :text="t('adminBaseUrlHint')" />
              </span>
              <input
                v-model="settings.baseUrl"
                type="text"
                spellcheck="false"
                :placeholder="t('adminBaseUrlPlaceholder')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">
                {{ t('adminChatModel') }}
                <FieldInfoHint :text="t('adminChatModelHint')" />
              </span>
              <input
                v-model="settings.chatModel"
                type="text"
                spellcheck="false"
                :placeholder="t('adminChatModelPlaceholder')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">
                {{ t('adminEmbedModel') }}
                <FieldInfoHint :text="t('adminEmbedModelHint')" />
              </span>
              <input
                v-model="settings.embedModel"
                type="text"
                spellcheck="false"
                :placeholder="t('adminEmbedModelPlaceholder')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">
                {{ t('adminEmbedDim') }}
                <FieldInfoHint :text="t('adminEmbedDimHint')" />
              </span>
              <input
                v-model="settings.embedDim"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                :placeholder="t('adminEmbedDimPlaceholder')"
              />
            </label>
            <div class="section-foot">
              <button type="submit" class="cta" :disabled="loadingSettings">{{ t('adminSave') }}</button>
            </div>
          </form>
        </section>

        <!-- 用户 -->
        <section v-show="section === 'users'" class="section">
          <h2 class="section-title">{{ t('adminCreateUser') }}</h2>
          <form class="fields fields--aligned" novalidate @submit.prevent="createUser">
            <label class="field">
              <span class="field-name field-name--required">{{ t('username') }}</span>
              <input
                v-model.trim="newUser.email"
                type="text"
                autocomplete="off"
                :placeholder="t('adminUsernamePlaceholder')"
              />
            </label>
            <label class="field">
              <span class="field-name field-name--required">{{ t('password') }}</span>
              <input
                v-model="newUser.password"
                type="password"
                autocomplete="new-password"
                :placeholder="t('adminPasswordHint')"
              />
            </label>
            <div class="section-foot">
              <button type="submit" class="cta" :disabled="loadingCreate">{{ t('adminCreate') }}</button>
            </div>
          </form>

          <div class="user-block">
            <h2 class="section-title">{{ t('adminUsers') }}</h2>
            <ul v-if="users.length" class="user-list">
              <li v-for="u in users" :key="u.id" class="user-row">
                <span class="user-name">{{ u.email }}</span>
                <span v-if="u.isAdmin" class="user-tag">{{ t('adminTag') }}</span>
                <button
                  v-if="!u.isAdmin"
                  type="button"
                  class="text-btn"
                  @click="openReset(u)"
                >
                  {{ t('adminResetPassword') }}
                </button>
                <button
                  v-if="!u.isAdmin"
                  type="button"
                  class="text-btn text-btn--danger"
                  @click="openDelete(u)"
                >
                  {{ t('adminDeleteUser') }}
                </button>
              </li>
            </ul>
            <p v-else class="empty-hint">{{ t('adminNoUsers') }}</p>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="resetTarget" class="modal" @click.self="resetTarget = null">
        <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
          <header class="modal-head">
            <h3 id="reset-dialog-title">{{ t('adminResetFor', { name: resetTarget.email }) }}</h3>
          </header>
          <div class="modal-body">
            <label class="modal-field">
              <span class="field-name field-name--required">{{ t('newPassword') }}</span>
              <input
                v-model="resetPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('adminPasswordHint')"
              />
            </label>
            <label class="modal-field">
              <span class="field-name field-name--required">{{ t('confirmPassword') }}</span>
              <input
                v-model="resetConfirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('confirmPasswordPlaceholder')"
              />
            </label>
          </div>
          <footer class="modal-foot">
            <button type="button" class="modal-btn" @click="resetTarget = null">{{ t('cancel') }}</button>
            <button type="button" class="modal-btn modal-btn--accent" :disabled="loadingReset" @click="confirmReset">
              {{ t('adminSave') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal" @click.self="deleteTarget = null">
        <div
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <header class="modal-head">
            <h3 id="delete-dialog-title">{{ t('adminDeleteFor', { name: deleteTarget.email }) }}</h3>
          </header>
          <div class="modal-body">
            <p class="modal-hint">{{ t('adminDeleteConfirm') }}</p>
          </div>
          <footer class="modal-foot">
            <button type="button" class="modal-btn" @click="deleteTarget = null">{{ t('cancel') }}</button>
            <button
              type="button"
              class="modal-btn modal-btn--danger"
              :disabled="loadingDelete"
              @click="confirmDelete"
            >
              {{ t('adminDeleteUser') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  adminChangePassword,
  adminCreateUser,
  adminDeleteUser,
  adminGetSettings,
  adminListUsers,
  adminResetUserPassword,
  adminSaveSettings
} from '../http/api'
import { apiMessage } from '../http/httpInstance'
import { useAuth } from '../stores/auth'
import { toastError, toastSuccess } from '../composables/useToast'
import FieldInfoHint from '../components/FieldInfoHint.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()

const sections = [
  { id: 'model', label: 'adminNavModel' },
  { id: 'account', label: 'adminNavAccount' },
  { id: 'users', label: 'adminNavUsers' }
]

const section = ref('model')
const users = ref([])
const resetTarget = ref(null)
const resetPassword = ref('')
const resetConfirmPassword = ref('')
const deleteTarget = ref(null)
const newPassword = ref('')
const confirmPassword = ref('')
const loadingPw = ref(false)
const loadingSettings = ref(false)
const loadingCreate = ref(false)
const loadingReset = ref(false)
const loadingDelete = ref(false)

const settings = reactive({
  apiKey: '',
  baseUrl: '',
  chatModel: '',
  embedModel: '',
  embedDim: 1024
})
const newUser = reactive({ email: '', password: '' })

async function load() {
  const [settingsData, usersData] = await Promise.all([adminGetSettings(), adminListUsers()])
  settings.apiKey = settingsData.openaiApiKey || ''
  settings.baseUrl = settingsData.openaiBaseUrl || ''
  settings.chatModel = settingsData.openaiChatModel || ''
  settings.embedModel = settingsData.openaiEmbedModel || ''
  settings.embedDim = settingsData.embedDim || 1024
  users.value = usersData.users || []
}

onMounted(async () => {
  try {
    await load()
  } catch (e) {
    toastError(apiMessage(e))
  }
})

async function saveMyPassword() {
  const password = newPassword.value
  const confirm = confirmPassword.value
  if (!password || password.length < 6) {
    toastError(t('adminPasswordHint'))
    return
  }
  if (!confirm) {
    toastError(t('confirmPasswordRequired'))
    return
  }
  if (password !== confirm) {
    toastError(t('passwordMismatch'))
    return
  }

  loadingPw.value = true
  try {
    await adminChangePassword({ password })
    newPassword.value = ''
    confirmPassword.value = ''
    await auth.logout()
    router.push('/')
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    loadingPw.value = false
  }
}

async function saveSettings() {
  const apiKey = settings.apiKey.trim()
  const baseUrl = settings.baseUrl.trim()
  const chatModel = settings.chatModel.trim()
  const embedModel = settings.embedModel.trim()
  const embedDim = Number(settings.embedDim)
  if (!apiKey || !baseUrl || !chatModel || !embedModel || !embedDim) {
    toastError(t('adminModelIncomplete'))
    return
  }

  loadingSettings.value = true
  try {
    const data = await adminSaveSettings({
      openaiApiKey: apiKey,
      openaiBaseUrl: baseUrl,
      openaiChatModel: chatModel,
      openaiEmbedModel: embedModel,
      embedDim
    })
    await load()
    toastSuccess(data.message || t('adminSaved'))
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    loadingSettings.value = false
  }
}

async function createUser() {
  loadingCreate.value = true
  try {
    await adminCreateUser({ email: newUser.email, password: newUser.password })
    newUser.email = ''
    newUser.password = ''
    await load()
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    loadingCreate.value = false
  }
}

function openReset(user) {
  resetTarget.value = user
  resetPassword.value = ''
  resetConfirmPassword.value = ''
}

async function confirmReset() {
  if (!resetTarget.value) return
  const password = resetPassword.value
  const confirm = resetConfirmPassword.value
  if (!password || password.length < 6) {
    toastError(t('adminPasswordHint'))
    return
  }
  if (!confirm) {
    toastError(t('confirmPasswordRequired'))
    return
  }
  if (password !== confirm) {
    toastError(t('passwordMismatch'))
    return
  }

  loadingReset.value = true
  try {
    const data = await adminResetUserPassword(resetTarget.value.id, { password })
    resetTarget.value = null
    resetPassword.value = ''
    resetConfirmPassword.value = ''
    toastSuccess(data.message || t('adminSaved'))
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    loadingReset.value = false
  }
}

function openDelete(user) {
  deleteTarget.value = user
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  loadingDelete.value = true
  try {
    await adminDeleteUser(deleteTarget.value.id)
    deleteTarget.value = null
    await load()
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    loadingDelete.value = false
  }
}
</script>

<style scoped>
.admin {
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--paper-workspace);
  animation: rise 0.45s ease-out both;
}
.admin-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(20px, 2.5vw, 32px) var(--page-pad-x) 64px;
  box-sizing: border-box;
}
.admin-tabs {
  display: flex;
  gap: clamp(20px, 4vw, 40px);
  margin-bottom: 32px;
  border-bottom: 1px solid var(--line);
}
.tab {
  position: relative;
  padding: 12px 2px 14px;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}
.tab:hover {
  color: var(--ink);
}
.tab.active {
  color: var(--ink);
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
}
.section-title {
  font-family: var(--font-brand);
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px;
  letter-spacing: 0.04em;
}
.section-lead {
  margin: -8px 0 20px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--muted);
}
.section-lead--model {
  margin-top: 0;
}
.model-guide {
  margin-bottom: 28px;
  padding: 14px 16px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--paper-workspace) 55%, var(--line));
}
.model-guide-toggle {
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.model-guide-toggle::-webkit-details-marker {
  display: none;
}
.model-guide-toggle::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.15s ease;
}
.model-guide[open] .model-guide-toggle::before {
  transform: rotate(90deg);
}
.model-guide-steps {
  margin: 12px 0 0;
  padding-left: 1.2em;
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted);
}
.model-guide-steps li + li {
  margin-top: 8px;
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.fields--aligned {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: clamp(36px, 6vw, 52px);
  row-gap: 26px;
  align-items: center;
}
.fields--aligned.fields--model {
  row-gap: 28px;
}
.fields--aligned > .field {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}
.fields--aligned > .section-foot {
  grid-column: 1 / -1;
}
.field-name {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 14px;
  color: var(--muted);
  white-space: nowrap;
  padding-right: 4px;
}
.field-name--required::before {
  content: '*';
  margin-right: 3px;
  color: var(--error);
  font-weight: 500;
  line-height: 1;
}
.field input {
  width: 100%;
  box-sizing: border-box;
  border: none;
  border-bottom: 1px solid var(--line);
  background: transparent;
  padding: 8px 0;
  font: inherit;
  font-size: 15px;
  color: var(--ink);
  outline: none;
}
.field input:focus {
  border-bottom-color: var(--accent);
}
.field input::placeholder {
  color: color-mix(in srgb, var(--muted) 70%, transparent);
  font-size: 13px;
}
.section-foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
.cta {
  padding: 10px 20px;
  border: none;
  border-radius: 2px;
  background: var(--accent);
  color: #f7f9f6;
  font: inherit;
  font-size: 14px;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.cta:disabled {
  opacity: 0.55;
  cursor: default;
}
.cta:not(:disabled):hover {
  background: var(--accent-hover);
}
.user-block {
  margin-top: 48px;
}
.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
}
.user-row + .user-row {
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
.user-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-tag {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}
.text-btn {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}
.text-btn:hover {
  color: var(--ink);
}
.text-btn--danger {
  color: #8b3a3a;
}
.text-btn--danger:hover {
  color: #6b2a2a;
}
.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--ink) 36%, transparent);
  backdrop-filter: blur(2px);
  animation: modal-fade 0.18s ease-out both;
}
.modal-panel {
  width: min(420px, 100%);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: 10px;
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 4%, transparent),
    0 16px 40px color-mix(in srgb, var(--ink) 14%, transparent);
  overflow: hidden;
  animation: modal-rise 0.22s ease-out both;
}
.modal-head {
  padding: 22px 24px 0;
}
.modal-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.45;
  color: var(--ink);
  word-break: break-word;
}
.modal-body {
  padding: 14px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted);
}
.modal-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
.modal-field input {
  border: none;
  border-bottom: 1px solid var(--line);
  background: transparent;
  padding: 10px 0;
  font: inherit;
  font-size: 15px;
  color: var(--ink);
  outline: none;
}
.modal-field input:focus {
  border-bottom-color: var(--accent);
}
.modal-field input::placeholder {
  color: color-mix(in srgb, var(--muted) 70%, transparent);
  font-size: 13px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 16px 24px 20px;
}
.modal-btn {
  min-width: 72px;
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.modal-btn:hover {
  background: color-mix(in srgb, var(--paper-workspace) 70%, var(--line));
  border-color: color-mix(in srgb, var(--muted) 35%, var(--line));
}
.modal-btn--accent {
  border-color: var(--accent);
  background: var(--accent);
  color: #f7f9f6;
}
.modal-btn--accent:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #f7f9f6;
}
.modal-btn--danger {
  border-color: #8b3a3a;
  background: #8b3a3a;
  color: #faf7f6;
}
.modal-btn--danger:hover {
  background: #6f2e2e;
  border-color: #6f2e2e;
  color: #faf7f6;
}
.modal-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
@keyframes modal-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes modal-rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 560px) {
  .admin-tabs {
    gap: 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .tab {
    flex-shrink: 0;
  }
  .fields--aligned {
    grid-template-columns: 1fr;
    row-gap: 22px;
  }
  .fields--aligned > .field {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
