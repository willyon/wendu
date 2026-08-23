<template>
  <div
    class="composer"
    :class="{ 'composer--dock': dock, 'composer--drop': dropActive }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div v-if="scopedFiles.length" class="chips">
      <span
        v-for="file in scopedFiles"
        :key="file.id"
        class="chip"
      >
        <span class="chip-name">{{ file.filename }}</span>
        <button
          type="button"
          class="chip-remove"
          :aria-label="t('scopeRemove')"
          @click="emit('remove-scope', file.id)"
        >
          ×
        </button>
      </span>
    </div>
    <div class="composer-inner">
      <input
        ref="inputEl"
        v-model="question"
        :placeholder="placeholder"
        :disabled="disabled || sending"
        @keyup.enter="onSubmit"
      />
      <button
        v-if="sending"
        type="button"
        class="cta cta--stop"
        @click="emit('stop')"
      >
        {{ t('askStop') }}
      </button>
      <button
        v-else
        type="button"
        class="cta"
        :disabled="disabled || !question.trim()"
        @click="onSubmit"
      >
        {{ t('askSubmit') }}
      </button>
    </div>
    <p v-if="showScopeHint" class="composer-hint">{{ t('askScopeHint') }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MIME } from '../composables/useAskScope'

const props = defineProps({
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  dock: { type: Boolean, default: false },
  scopedFiles: { type: Array, default: () => [] },
  showScopeHint: { type: Boolean, default: false },
  draftRestore: { type: Object, default: null }
})

const emit = defineEmits(['submit', 'stop', 'add-scope', 'remove-scope'])

const { t } = useI18n()
const question = ref('')
const inputEl = ref(null)
const dropActive = ref(false)

watch(
  () => props.draftRestore?.seq,
  (seq) => {
    if (seq == null) return
    question.value = props.draftRestore?.text || ''
    nextTick(() => inputEl.value?.focus())
  }
)

const placeholder = computed(() => {
  if (props.scopedFiles.length) {
    return t('askPlaceholderScoped', { n: props.scopedFiles.length })
  }
  return t('askPlaceholder')
})

function onSubmit() {
  const q = question.value.trim()
  if (!q || props.disabled || props.sending) return
  emit('submit', q)
  question.value = ''
}

function onDragOver(event) {
  if (!event.dataTransfer?.types.includes(MIME)) return
  dropActive.value = true
}

function onDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  dropActive.value = false
}

function onDrop(event) {
  dropActive.value = false
  const raw = event.dataTransfer?.getData(MIME)
  if (!raw) return
  event.stopPropagation()
  try {
    const file = JSON.parse(raw)
    if (file?.id) emit('add-scope', file)
  } catch {
    /* ignore */
  }
}
</script>

<style scoped>
.composer {
  width: 100%;
  margin: 0 auto;
}
.composer--dock {
  width: 100%;
}
.composer--drop .composer-inner {
  border-bottom-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 5px 6px 5px 12px;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.3;
  color: color-mix(in srgb, var(--ink) 78%, var(--muted));
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(280px, 60vw);
}
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: transparent;
  padding: 0;
  font: inherit;
  font-size: 15px;
  line-height: 1;
  color: color-mix(in srgb, var(--muted) 80%, transparent);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.chip-remove:hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
}
.composer-inner {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 6px 4px 10px;
  border-bottom: 1px solid var(--line);
  background: transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.composer-inner:focus-within {
  border-bottom-color: var(--accent);
}
.composer input {
  flex: 1;
  min-width: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  background-color: transparent;
  padding: 10px 0;
  font: inherit;
  font-size: 16px;
  outline: none;
  color: var(--ink);
  text-align: left;
  -webkit-appearance: none;
  appearance: none;
}
.composer input:focus,
.composer input:hover {
  background: transparent;
  background-color: transparent;
}
.composer input:-webkit-autofill,
.composer input:-webkit-autofill:hover,
.composer input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--ink);
  caret-color: var(--ink);
  transition: background-color 99999s ease-out;
  box-shadow: 0 0 0 1000px transparent inset;
}
.composer input::placeholder {
  color: color-mix(in srgb, var(--muted) 75%, transparent);
}
.composer input:disabled {
  opacity: 0.55;
}
.cta {
  padding: 10px 20px;
  border: none;
  border-radius: 2px;
  background: var(--accent);
  color: #f7f9f6;
  font: inherit;
  font-size: 14px;
  letter-spacing: 0.08em;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease;
}
.cta:disabled {
  opacity: 0.4;
  cursor: default;
}
.cta:not(:disabled):hover {
  background: var(--accent-hover);
}
.cta--stop {
  background: color-mix(in srgb, var(--ink) 82%, var(--accent));
}
.cta--stop:hover {
  background: color-mix(in srgb, var(--ink) 72%, var(--accent));
}
.composer-hint {
  margin: 8px 0 0;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--muted) 88%, transparent);
}
.composer--drop .composer-hint {
  color: color-mix(in srgb, var(--accent) 70%, var(--muted));
}
@media (max-width: 480px) {
  .composer-inner {
    flex-wrap: wrap;
  }
  .cta {
    width: 100%;
  }
}
</style>
