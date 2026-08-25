<!--
  Library sidebar: pick/drop upload, list status polling, delete.
  Upload flow: hash → prepare → PUT storage → complete → poll ready/failed.
  Does not own: ask panel (AskPanel), conversation list (ConversationSidebar).
-->
<template>
  <aside class="file-sidebar" :class="{ 'file-sidebar--empty': isEmpty }">
    <button
      type="button"
      class="drop"
      :class="{
        'drop--active': dragging,
        'drop--compact': !isEmpty
      }"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <span class="drop-label">{{ t('upload') }}</span>
      <span class="drop-hint">{{ t('uploadDropHint') }}</span>
      <span class="drop-types">{{ t('uploadTypes') }}</span>
    </button>

    <input
      ref="fileInput"
      type="file"
      multiple
      accept=".pdf,.md,.markdown,.txt,.docx,.pptx,.csv,.xlsx"
      hidden
      @change="onInput"
    />

    <ul v-if="rows.length" class="list wendu-scroll">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        class="file-row"
        :class="{
          'file-row--scoped': isScoped(row.id),
          'file-row--ready': row.status === 'ready' && !row.track,
          'file-row--source-drag': draggingFileId === row.id
        }"
        :draggable="row.status === 'ready' && !row.track"
        @dragstart="onDragStart($event, row)"
        @dragend="draggingFileId = null"
        @click="onRowClick(row)"
      >
        <div class="row-line">
          <span class="index" :data-status="row.dotStatus">{{ index + 1 }}</span>
          <span class="name">{{ row.filename }}</span>
          <button
            v-if="row.status === 'ready' && !row.track"
            type="button"
            class="del"
            @click.stop="remove(row)"
          >
            {{ t('delete') }}
          </button>
          <button
            v-else-if="row.status === 'failed' && !row.track"
            type="button"
            class="del"
            @click.stop="remove(row)"
          >
            {{ t('delete') }}
          </button>
        </div>
        <p v-if="showStatus(row)" class="status">
          <template v-if="row.track?.phase === 'hashing'">{{ t('uploadHashing') }}</template>
          <template v-else-if="row.track?.phase === 'uploading'">
            <span class="upload-progress" role="progressbar" :aria-valuenow="row.track.progress ?? 0" aria-valuemin="0" aria-valuemax="100">
              <span class="upload-progress-track">
                <span class="upload-progress-bar" :style="{ width: `${row.track.progress ?? 0}%` }" />
              </span>
              <span class="upload-progress-label">{{ t('uploadPercent', { n: row.track.progress ?? 0 }) }}</span>
            </span>
          </template>
          <template v-else-if="row.status === 'failed'">
            {{ t('statusFailed') }}
            <span v-if="row.failReasonMessage || row.failReason" class="fail-detail">
              · {{ row.failReasonMessage || row.failReason }}
            </span>
          </template>
          <template v-else-if="row.status === 'processing'">{{ t('processingHint') }}</template>
          <template v-else>{{ t('statusPending') }}</template>
        </p>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAskScope } from '../../composables/useAskScope'
import {
  completeUpload,
  deleteFile,
  listFiles,
  prepareUpload
} from '../../http/api'
import { apiMessage } from '../../http/httpInstance'
import { toastError } from '../../composables/useToast'
import { directUpload, sha256File } from '../../http/upload'

defineProps({
  isScoped: { type: Function, required: true }
})

const emit = defineEmits(['toggle-scope', 'drag-start', 'ready-change', 'library-empty-change'])

const { t } = useI18n()
const { onDragStart: scopeDragStart } = useAskScope()

const files = ref([])
const uploadTracks = reactive({})
const fileInput = ref(null)
const dragging = ref(false)
const draggingFileId = ref(null)

const readyCount = computed(() => files.value.filter((f) => f.status === 'ready').length)
const isEmpty = computed(() => !files.value.length && !Object.keys(uploadTracks).length)
const needsPoll = computed(() =>
  files.value.some((f) => f.status === 'pending' || f.status === 'processing')
)

const rows = computed(() => {
  const serverIds = new Set(files.value.map((f) => f.id))
  const localRows = Object.entries(uploadTracks)
    .filter(([key]) => !serverIds.has(key))
    .map(([id, track]) => ({
      id,
      filename: track.filename,
      status: 'uploading',
      dotStatus: 'pending',
      track
    }))

  const serverRows = files.value.map((f) => ({
    ...f,
    dotStatus: uploadTracks[f.id] ? 'pending' : f.status,
    track: uploadTracks[f.id] || null
  }))

  return [...localRows, ...serverRows]
})

let pollTimer = null

function showStatus(row) {
  if (row.status === 'ready' && !row.track) return false
  return true
}

function clearPoll() {
  if (pollTimer != null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function schedulePoll() {
  clearPoll()
  if (!needsPoll.value) return
  pollTimer = setTimeout(async () => {
    pollTimer = null
    await refresh()
    schedulePoll()
  }, 2500)
}

async function refresh() {
  const data = await listFiles()
  files.value = data.files
  emit('ready-change', readyCount.value)
  emit('library-empty-change', isEmpty.value)
  schedulePoll()
}

watch(isEmpty, (value) => {
  emit('library-empty-change', value)
})

function openPicker() {
  fileInput.value?.click()
}

function onInput(e) {
  const list = [...(e.target.files || [])]
  e.target.value = ''
  list.forEach((file) => uploadOne(file))
}

function onDragLeave(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return
  dragging.value = false
}

function onDrop(e) {
  dragging.value = false
  const files = [...(e.dataTransfer?.files || [])]
  if (!files.length) return
  e.stopPropagation()
  uploadFiles(files)
}

function uploadFiles(fileList) {
  ;[...fileList].forEach((file) => uploadOne(file))
}

function clearTrack(...keys) {
  keys.forEach((key) => {
    if (key) delete uploadTracks[key]
  })
}

async function uploadOne(file) {
  if (!file) return
  const clientKey = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`
  uploadTracks[clientKey] = { filename: file.name, progress: null, phase: 'hashing' }
  let fileId = null
  try {
    const contentHash = await sha256File(file)
    const data = await prepareUpload({
      filename: file.name,
      byteSize: file.size,
      contentHash,
      contentType: file.type || 'application/octet-stream'
    })
    clearTrack(clientKey)

    if (data.type === 'instant') {
      await refresh()
      return
    }

    fileId = data.file.id
    uploadTracks[fileId] = { filename: file.name, progress: 0, phase: 'uploading' }
    await refresh()

    await directUpload(data.credential, file, (percent) => {
      const track = uploadTracks[fileId]
      if (track) track.progress = percent
    })

    clearTrack(fileId)
    await completeUpload({ fileId: data.file.id })
    await refresh()
  } catch (e) {
    clearTrack(clientKey, fileId)
    toastError(apiMessage(e))
    await refresh()
  }
}

async function remove(row) {
  if (row.track) return
  try {
    await deleteFile(row.id)
    await refresh()
  } catch (e) {
    toastError(apiMessage(e))
  }
}

function onRowClick(row) {
  if (row.track || row.status !== 'ready') return
  emit('toggle-scope', row)
}

function onDragStart(event, row) {
  if (row.track || row.status !== 'ready') return
  draggingFileId.value = row.id
  scopeDragStart(event, row)
  emit('drag-start', row)
}

defineExpose({ refresh, readyCount, uploadFiles })

onMounted(refresh)
onUnmounted(clearPoll)
</script>

<style scoped>
.file-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--page-pad-y) 24px 20px;
  box-sizing: border-box;
  border-left: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
  border-right: none;
  background: transparent;
}
.file-sidebar--empty {
  justify-content: flex-start;
}
.file-sidebar--empty .drop:not(.drop--compact) {
  flex: 0 1 auto;
  min-height: min(320px, 42vh);
  max-height: min(440px, 52vh);
  margin-top: 0;
  padding: 56px 48px;
  gap: 12px;
}
.drop {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: min(280px, 38vh);
  padding: 40px 24px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, var(--line));
  border-radius: 2px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}
.drop--compact {
  min-height: 0;
  padding: 20px 16px;
  gap: 6px;
  margin-bottom: 20px;
}
.drop:hover,
.drop--active {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  color: var(--ink);
}
.drop-label {
  font-family: var(--font-brand);
  font-size: clamp(20px, 2.4vw, 26px);
  font-weight: 600;
  letter-spacing: 0.1em;
  color: inherit;
  text-align: center;
}
.file-sidebar--empty .drop:not(.drop--compact) .drop-label {
  font-size: clamp(22px, 2.6vw, 28px);
  letter-spacing: 0.12em;
}
.drop--compact .drop-label {
  font-size: 16px;
  letter-spacing: 0.08em;
}
.drop-hint {
  font-size: 13px;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--muted) 88%, transparent);
  text-align: center;
  max-width: 28em;
  line-height: 1.55;
}
.drop-types {
  font-size: 12px;
  letter-spacing: 0.06em;
  line-height: 1.65;
  text-align: center;
  max-width: 36em;
  opacity: 0.55;
}
.file-sidebar--empty .drop:not(.drop--compact) .drop-types {
  margin-top: 4px;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  text-transform: none;
}
.err {
  color: #8b3a3a;
  font-size: 13px;
  margin: 12px 0 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0 6px 0 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  overscroll-behavior: contain;
}
.file-row {
  padding: 14px 0;
  cursor: default;
}
.file-row:first-child {
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
.file-row--scoped {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.file-row--source-drag {
  opacity: 0.42;
}
.row-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.index {
  flex-shrink: 0;
  align-self: center;
  min-width: 1.25em;
  font-size: 12px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  text-align: right;
}
.index[data-status='ready'] {
  color: var(--accent);
}
.index[data-status='processing'],
.index[data-status='pending'] {
  color: color-mix(in srgb, var(--accent) 65%, var(--muted));
}
.index[data-status='failed'] {
  color: #8b3a3a;
}
.name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: 0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.status {
  margin: 8px 0 0;
  padding-left: calc(1.25em + 10px);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
.fail-detail {
  font-weight: 400;
}
.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.upload-progress-track {
  width: 100%;
  max-width: 180px;
  height: 3px;
  border-radius: 1px;
  background: var(--line);
  overflow: hidden;
}
.upload-progress-bar {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.12s ease;
}
.upload-progress-label {
  font-size: 11px;
}
.del {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
  letter-spacing: 0.02em;
}
.del:hover {
  color: #8b3a3a;
}
</style>
