import { ref } from 'vue'

export const MIME = 'application/x-wendu-file'
const scopedFiles = ref([])

export function useAskScope() {
  function isScoped(fileId) {
    return scopedFiles.value.some((f) => f.id === fileId)
  }

  function toggleScope(file) {
    if (!file || file.status !== 'ready') return
    const idx = scopedFiles.value.findIndex((f) => f.id === file.id)
    if (idx >= 0) {
      scopedFiles.value.splice(idx, 1)
      return
    }
    scopedFiles.value.push({ id: file.id, filename: file.filename })
  }

  function addScope(file) {
    if (!file?.id || isScoped(file.id)) return
    scopedFiles.value.push({ id: file.id, filename: file.filename || '' })
  }

  function removeScope(fileId) {
    const idx = scopedFiles.value.findIndex((f) => f.id === fileId)
    if (idx >= 0) scopedFiles.value.splice(idx, 1)
  }

  function clearScope() {
    scopedFiles.value = []
  }

  function scopeIds() {
    return scopedFiles.value.map((f) => f.id)
  }

  function dragPayload(file) {
    return JSON.stringify({ id: file.id, filename: file.filename })
  }

  function setFilenameDragImage(event, filename) {
    const ghost = document.createElement('div')
    ghost.textContent = filename
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      zIndex: '-1',
      maxWidth: '320px',
      padding: '8px 14px',
      fontFamily: 'var(--font-body, sans-serif)',
      fontSize: '14px',
      lineHeight: '1.45',
      letterSpacing: '0.01em',
      color: '#1c2420',
      background: 'rgba(255, 255, 255, 0.92)',
      border: '1px solid #d4dbd5',
      borderRadius: '2px',
      boxShadow: '0 6px 20px rgba(28, 36, 32, 0.1)',
      pointerEvents: 'none',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    })
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(ghost, 16, 18)
    requestAnimationFrame(() => ghost.remove())
  }

  function onDragStart(event, file) {
    if (file.status !== 'ready') return
    event.dataTransfer.setData(MIME, dragPayload(file))
    event.dataTransfer.effectAllowed = 'copy'
    setFilenameDragImage(event, file.filename)
  }

  return {
    scopedFiles,
    isScoped,
    toggleScope,
    addScope,
    removeScope,
    clearScope,
    scopeIds,
    onDragStart,
    MIME
  }
}