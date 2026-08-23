<template>
  <aside class="conv-sidebar">
    <div class="conv-list wendu-scroll">
      <button
        type="button"
        class="conv-new"
        :disabled="sending"
        @click="createNewConversation"
      >
        <span class="conv-new-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M18.375 2.625a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414l-9.025 9.025-3.9 1.05 1.05-3.9 9.025-9.025z"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="conv-new-text">{{ t('convNew') }}</span>
      </button>

      <div
        v-for="c in conversations"
        :key="c.id"
        class="conv-item"
        :class="{
          'conv-item--active': c.id === activeConversationId,
          'conv-item--editing': editingId === c.id
        }"
      >
        <template v-if="editingId === c.id">
          <span class="conv-item-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H6l-3 2v-2.5A1.5 1.5 0 0 1 3 9.5v-5Z"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <input
            :ref="(el) => setEditInput(el)"
            v-model="editDraft"
            class="conv-item-input"
            type="text"
            maxlength="80"
            :disabled="renaming"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename"
            @click.stop
          />
        </template>
        <template v-else>
          <button
            type="button"
            class="conv-item-main"
            :disabled="sending"
            @click="switchConversation(c.id)"
          >
            <span class="conv-item-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H6l-3 2v-2.5A1.5 1.5 0 0 1 3 9.5v-5Z"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="conv-item-title">{{ displayTitle(c) }}</span>
          </button>
          <button
            type="button"
            class="conv-item-action conv-item-edit"
            :disabled="sending"
            :aria-label="t('convRename')"
            @click.stop="startRename(c)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20h9"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
              <path
                d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="conv-item-action conv-item-del"
            :disabled="sending"
            :aria-label="t('convDelete')"
            @click.stop="askDelete(c)"
          >
            ×
          </button>
        </template>
      </div>
    </div>

    <ConfirmDialog
      :open="Boolean(deleteTarget)"
      :title="t('convDeleteTitle')"
      :hint="t('convDeleteConfirm')"
      :confirm-label="t('delete')"
      :cancel-label="t('cancel')"
      danger
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </aside>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from '../ConfirmDialog.vue'
import { toastError } from '../../composables/useToast'
import { apiMessage } from '../../http/httpInstance'
import { useAskSession } from '../../composables/useAskSession'

const { t } = useI18n()
const {
  conversations,
  activeConversationId,
  sending,
  createNewConversation,
  switchConversation,
  removeConversation,
  renameConversation,
  init
} = useAskSession()

const editingId = ref('')
const editDraft = ref('')
const editInputEl = ref(null)
const renaming = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)
let skipBlurSave = false

function setEditInput(el) {
  editInputEl.value = el
}

function displayTitle(c) {
  return (c.title || '').trim() || t('convUntitled')
}

async function startRename(c) {
  if (sending.value || renaming.value) return
  editingId.value = c.id
  editDraft.value = displayTitle(c)
  skipBlurSave = false
  await nextTick()
  editInputEl.value?.focus()
  editInputEl.value?.select()
}

function cancelRename() {
  skipBlurSave = true
  editingId.value = ''
  editDraft.value = ''
}

async function commitRename() {
  if (skipBlurSave) {
    skipBlurSave = false
    return
  }
  const id = editingId.value
  if (!id || renaming.value) return

  const next = editDraft.value.trim()
  const current = conversations.value.find((c) => c.id === id)
  const prev = displayTitle(current || {})

  if (next === prev || (next === '' && !(current?.title || '').trim())) {
    editingId.value = ''
    editDraft.value = ''
    return
  }

  renaming.value = true
  try {
    await renameConversation(id, next)
    editingId.value = ''
    editDraft.value = ''
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    renaming.value = false
  }
}

function askDelete(c) {
  if (sending.value) return
  deleteTarget.value = c
}

async function confirmDelete() {
  const c = deleteTarget.value
  if (!c || deleting.value) return
  deleting.value = true
  try {
    await removeConversation(c.id)
    deleteTarget.value = null
  } catch (e) {
    toastError(apiMessage(e))
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  try {
    await init()
  } catch (e) {
    toastError(apiMessage(e))
  }
})
</script>

<style scoped>
.conv-sidebar {
  flex-shrink: 0;
  width: min(260px, 24vw);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--paper-workspace) 92%, var(--line));
  border-right: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  box-sizing: border-box;
}
.conv-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 10px 16px;
}
.conv-new {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}
.conv-new:not(:disabled):hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.conv-new:disabled {
  opacity: 0.45;
  cursor: default;
}
.conv-new-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: color-mix(in srgb, var(--ink) 58%, var(--muted));
}
.conv-new-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 10px;
  transition: background 0.15s ease;
}
.conv-item--active,
.conv-item--editing {
  background: color-mix(in srgb, var(--ink) 7%, transparent);
}
.conv-item:not(.conv-item--active):not(.conv-item--editing):hover {
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}
.conv-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 9px 4px 9px 10px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  color: color-mix(in srgb, var(--ink) 78%, var(--muted));
  transition: color 0.15s ease;
}
.conv-item--active .conv-item-main {
  color: var(--ink);
}
.conv-item-main:disabled {
  cursor: default;
}
.conv-item-icon {
  display: inline-flex;
  flex-shrink: 0;
  margin-left: 10px;
  color: color-mix(in srgb, var(--muted) 88%, transparent);
}
.conv-item-main .conv-item-icon {
  margin-left: 0;
}
.conv-item--active .conv-item-icon,
.conv-item--editing .conv-item-icon {
  color: color-mix(in srgb, var(--ink) 55%, var(--muted));
}
.conv-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.4;
}
.conv-item-input {
  flex: 1;
  min-width: 0;
  margin: 4px 8px 4px 0;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink);
  outline: none;
}
.conv-item-input:focus {
  border-color: var(--accent);
}
.conv-item-action {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.conv-item-del {
  margin-right: 4px;
  font-size: 16px;
  line-height: 1;
}
.conv-item:hover .conv-item-action,
.conv-item--active .conv-item-action {
  color: color-mix(in srgb, var(--muted) 75%, transparent);
}
.conv-item-action:not(:disabled):hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
}
.conv-item-action:disabled {
  cursor: default;
}
@media (max-width: 959px) {
  .conv-sidebar {
    width: 100%;
    max-height: min(180px, 30vh);
    border-right: none;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  }
  .conv-list {
    padding-top: 8px;
  }
  .conv-item-action {
    color: color-mix(in srgb, var(--muted) 65%, transparent);
  }
}
</style>
