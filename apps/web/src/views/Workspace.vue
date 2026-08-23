<template>
  <div
    class="workspace"
    :class="{
      'workspace--ask': panel === 'ask',
      'workspace--library': panel === 'library',
      'workspace--library-empty': libraryEmpty,
      'workspace--upload-drag': uploadDragging
    }"
    @dragenter="onWorkspaceDragEnter"
    @dragleave="onWorkspaceDragLeave"
    @dragover="onWorkspaceDragOver"
    @drop="onWorkspaceDrop"
  >
    <ConversationSidebar v-if="!libraryEmpty" class="workspace-conv" />
    <AskPanel
      v-if="!libraryEmpty"
      class="workspace-ask"
      :scoped-files="scopedFiles"
      :ready-count="readyCount"
      @submit="onAsk"
      @add-scope="addScope"
      @remove-scope="removeScope"
    />
    <FileSidebar
      ref="sidebarRef"
      class="workspace-files"
      :is-scoped="isScoped"
      @toggle-scope="toggleScope"
      @ready-change="readyCount = $event"
      @library-empty-change="libraryEmpty = $event"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAskScope } from '../composables/useAskScope'
import { useAskSession } from '../composables/useAskSession'
import { useWorkspacePanel } from '../composables/useWorkspacePanel'
import { isOsFileDrag } from '../composables/useOsFileDrag'
import AskPanel from '../components/workspace/AskPanel.vue'
import ConversationSidebar from '../components/workspace/ConversationSidebar.vue'
import FileSidebar from '../components/workspace/FileSidebar.vue'

const sidebarRef = ref(null)
const readyCount = ref(0)
const libraryEmpty = ref(true)
const uploadDragging = ref(false)
let uploadDragDepth = 0

const { panel } = useWorkspacePanel()
const { scopedFiles, isScoped, toggleScope, addScope, removeScope, clearScope } = useAskScope()
const { submit } = useAskSession()

async function onAsk({ question, fileIds }) {
  const ok = await submit(question, { fileIds })
  if (ok) clearScope()
}

function onWorkspaceDragEnter(event) {
  if (!isOsFileDrag(event)) return
  uploadDragDepth += 1
  uploadDragging.value = true
}

function onWorkspaceDragLeave(event) {
  if (!isOsFileDrag(event)) return
  uploadDragDepth = Math.max(0, uploadDragDepth - 1)
  if (uploadDragDepth === 0) uploadDragging.value = false
}

function onWorkspaceDragOver(event) {
  if (!isOsFileDrag(event)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function onWorkspaceDrop(event) {
  uploadDragDepth = 0
  uploadDragging.value = false
  if (!isOsFileDrag(event)) return
  const files = [...(event.dataTransfer?.files || [])]
  if (!files.length) return
  event.preventDefault()
  sidebarRef.value?.uploadFiles(files)
}
</script>

<style scoped>
.workspace {
  position: relative;
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  animation: rise 0.5s ease-out both;
}
.workspace--upload-drag::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border: 2px dashed color-mix(in srgb, var(--accent) 42%, var(--line));
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.workspace :deep(.workspace-ask) {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
}
.workspace :deep(.workspace-files) {
  flex-shrink: 0;
  width: min(340px, 32vw);
  height: 100%;
  min-height: 0;
}
.workspace--library-empty :deep(.workspace-conv),
.workspace--library-empty :deep(.workspace-ask) {
  display: none;
}
.workspace--library-empty :deep(.workspace-files) {
  width: 100%;
  max-width: none;
  border-left: none;
  align-items: center;
  justify-content: center;
  padding: var(--page-pad-y) var(--page-pad-x);
}
.workspace--library-empty :deep(.file-sidebar .head) {
  width: min(960px, 88vw);
  justify-content: center;
}
.workspace--library-empty :deep(.file-sidebar .drop:not(.drop--compact)) {
  width: min(960px, 88vw);
  max-width: min(960px, 88vw);
  margin-top: 14px;
}
@media (max-width: 959px) {
  .workspace--library :deep(.workspace-conv),
  .workspace--library :deep(.workspace-ask) {
    display: none;
  }
  .workspace--ask {
    flex-direction: column;
  }
  .workspace--ask :deep(.workspace-files) {
    display: none;
  }
  .workspace--ask :deep(.workspace-ask) {
    flex: 1;
    width: 100%;
    max-width: 100%;
  }
  .workspace--library-empty.workspace--ask :deep(.workspace-files) {
    display: flex;
  }
  .workspace--library :deep(.workspace-files),
  .workspace--ask :deep(.workspace-ask) {
    width: 100%;
    max-width: 100%;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
