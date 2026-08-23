<template>
  <section class="ask-panel">
    <div ref="threadEl" class="thread wendu-scroll" @scroll="onThreadScroll">
      <p v-if="showEmptyHint" class="thread-empty">{{ t('askEmptyHint') }}</p>
      <article v-for="(pair, i) in pairs" :key="i" class="turn">
        <div class="msg msg--user">
          <p class="msg-text">{{ pair.question }}</p>
        </div>
        <div class="msg msg--assistant">
          <template v-if="!pair.answer">
            <p class="msg-body msg-body--muted">{{ t('askWaiting') }}</p>
          </template>
          <template v-else-if="pair.answer.type === 'no_evidence'">
            <div class="msg-body msg-body--muted">
              {{ pair.answer.message || pair.answer.content }}
            </div>
          </template>
          <div v-else class="msg-body">
            <p
              v-if="pair.answer.streaming && !pair.answer.content"
              class="msg-body msg-body--muted"
            >
              {{ t('askWaiting') }}
            </p>
            <div v-else class="atext">
              <div class="md" v-html="renderAnswerHtml(pair.answer.content)" />
              <span v-if="pair.answer.streaming" class="stream-cursor" aria-hidden="true">▍</span>
            </div>
            <details
              v-if="!pair.answer.streaming && pair.answer.citations?.length"
              class="cites"
            >
              <summary class="cites-summary">{{ t('citations') }}</summary>
              <div class="cites-body">
                <details v-for="(c, j) in pair.answer.citations" :key="j" class="cite">
                  <summary class="cite-summary">
                    {{ c.fileDeleted ? t('fileDeleted') : (c.filename || '—') }}
                  </summary>
                  <p class="cite-snippet">{{ c.fileDeleted ? t('fileDeleted') : c.snippet }}</p>
                </details>
              </div>
            </details>
          </div>
        </div>
      </article>
      <article v-if="pendingQuestion" class="turn turn--pending">
        <div class="msg msg--user">
          <p class="msg-text">{{ pendingQuestion }}</p>
        </div>
        <div class="msg msg--assistant">
          <p class="msg-body msg-body--muted">{{ t('askWaiting') }}</p>
        </div>
      </article>
    </div>

    <div class="composer-wrap composer-wrap--dock">
      <AskComposer
        :sending="sending"
        :disabled="!canAsk"
        dock
        :scoped-files="scopedFiles"
        :show-scope-hint="canAsk && !scopedFiles.length"
        :draft-restore="restoredDraft"
        @submit="onSubmit"
        @stop="stop"
        @add-scope="(file) => emit('add-scope', file)"
        @remove-scope="(id) => emit('remove-scope', id)"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AskComposer from '../AskComposer.vue'
import { useAskSession } from '../../composables/useAskSession'
import { renderAnswerHtml } from '../../lib/renderAnswerMd'

const props = defineProps({
  scopedFiles: { type: Array, default: () => [] },
  readyCount: { type: Number, default: 0 }
})

const emit = defineEmits(['submit', 'add-scope', 'remove-scope'])

const { t } = useI18n()
const { pairs, hasThread, pendingQuestion, sending, stop, restoredDraft } = useAskSession()

const canAsk = computed(() => props.readyCount > 0)
const showEmptyHint = computed(() => canAsk.value && !hasThread.value && !sending.value && !pendingQuestion.value)

const threadEl = ref(null)
const stickToBottom = ref(true)
const NEAR_BOTTOM_PX = 80

function onThreadScroll() {
  const el = threadEl.value
  if (!el) return
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = gap <= NEAR_BOTTOM_PX
}

async function scrollThreadToBottom() {
  await nextTick()
  const el = threadEl.value
  if (!el || !stickToBottom.value) return
  el.scrollTop = el.scrollHeight
}

const streamFingerprint = computed(() =>
  pairs.value
    .map((p) => `${p.answer?.content?.length || 0}:${p.answer?.streaming ? 1 : 0}`)
    .join('|') + (pendingQuestion.value ? '|p' : '')
)

watch(streamFingerprint, () => {
  scrollThreadToBottom()
})

watch(sending, (v) => {
  if (v) {
    stickToBottom.value = true
    scrollThreadToBottom()
  }
})

function onSubmit(question) {
  const fileIds = props.scopedFiles.length ? props.scopedFiles.map((f) => f.id) : null
  emit('submit', { question, fileIds })
}
</script>

<style scoped>
.ask-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  --ask-content-max: 960px;
  box-sizing: border-box;
}
.thread {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 16px 0 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.thread-empty {
  margin: auto;
  padding: 0 var(--page-pad-x);
  max-width: var(--ask-content-max);
  font-size: 15px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--muted) 88%, transparent);
  text-align: center;
}
.turn {
  width: 100%;
  max-width: var(--ask-content-max);
  padding: 0 var(--page-pad-x);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.turn:last-child {
  padding-bottom: 0;
}
.msg--user {
  display: flex;
  justify-content: flex-end;
}
.msg-text {
  margin: 0 0 0 auto;
  max-width: min(88%, 560px);
  padding: 0;
  text-align: right;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: 0.01em;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.msg--assistant {
  align-self: flex-start;
  width: 100%;
  padding-top: 2px;
}
.msg-body {
  padding: 0;
}
.msg-body--muted {
  color: var(--muted);
  line-height: 1.75;
  font-size: 15px;
  margin: 0;
}
.atext {
  line-height: 1.8;
  margin: 0;
  font-size: 15.5px;
  overflow-wrap: anywhere;
  color: color-mix(in srgb, var(--ink) 92%, var(--muted));
}
.atext :deep(.md > *:first-child) {
  margin-top: 0;
}
.atext :deep(.md > *:last-child) {
  margin-bottom: 0;
}
.atext :deep(p) {
  margin: 0 0 0.85em;
}
.atext :deep(p:last-child) {
  margin-bottom: 0;
}
.atext :deep(ul),
.atext :deep(ol) {
  margin: 0.35em 0 0.85em;
  padding-left: 1.35em;
}
.atext :deep(li) {
  margin: 0.25em 0;
}
.atext :deep(li > p) {
  margin: 0;
}
.atext :deep(strong) {
  font-weight: 600;
  color: var(--ink);
}
.atext :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--line) 70%, transparent);
}
.atext :deep(pre) {
  margin: 0.6em 0 0.9em;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--line) 55%, transparent);
  font-size: 0.88em;
  line-height: 1.55;
}
.atext :deep(pre code) {
  padding: 0;
  background: none;
}
.atext :deep(h1),
.atext :deep(h2),
.atext :deep(h3),
.atext :deep(h4) {
  margin: 1em 0 0.45em;
  font-size: 1.05em;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
}
.atext :deep(blockquote) {
  margin: 0.6em 0;
  padding-left: 0.9em;
  border-left: 2px solid var(--line);
  color: var(--muted);
}
.stream-cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--accent);
  animation: stream-blink 1s step-end infinite;
  vertical-align: baseline;
}
@keyframes stream-blink {
  50% {
    opacity: 0;
  }
}
.cites {
  margin-top: 28px;
  padding-left: 14px;
  border-left: 2px solid color-mix(in srgb, var(--accent) 35%, var(--line));
}
.cites-summary {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: color 0.15s ease;
}
.cites-summary::-webkit-details-marker {
  display: none;
}
.cites-summary::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.15s ease;
}
.cites[open] > .cites-summary {
  color: var(--ink);
  margin-bottom: 8px;
}
.cites[open] > .cites-summary::before {
  transform: rotate(90deg);
}
.cites-summary:hover {
  color: var(--ink);
}
.cites-body {
  display: flex;
  flex-direction: column;
}
.cite {
  border-top: 1px solid var(--line);
  padding: 12px 0;
  font-size: 13px;
}
.cite:first-child {
  border-top: none;
}
.cite-summary {
  cursor: pointer;
  color: var(--muted);
  list-style: none;
  overflow-wrap: anywhere;
  line-height: 1.45;
  transition: color 0.15s ease;
}
.cite-summary::-webkit-details-marker {
  display: none;
}
.cite-summary::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.15s ease;
}
.cite[open] > .cite-summary::before {
  transform: rotate(90deg);
}
.cite-summary:hover,
.cite[open] .cite-summary {
  color: var(--ink);
}
.cite-snippet {
  margin: 12px 0 0;
  padding-left: 1.1em;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 13.5px;
}
.composer-wrap--dock {
  flex-shrink: 0;
  margin-top: auto;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 12px var(--page-pad-x) max(24px, 3.5vh);
  box-sizing: border-box;
}
.composer-wrap--dock :deep(.composer) {
  width: 100%;
  max-width: var(--ask-content-max);
}
@media (max-width: 480px) {
  .cites {
    padding-left: 10px;
  }
}
</style>
