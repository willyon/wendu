<template>
  <Teleport to="body">
    <div v-if="open" class="modal" @click.self="emit('cancel')">
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-dialog-title'"
      >
        <header class="modal-head">
          <h3 id="confirm-dialog-title">{{ title }}</h3>
        </header>
        <div v-if="hint" class="modal-body">
          <p class="modal-hint">{{ hint }}</p>
        </div>
        <footer class="modal-foot">
          <button type="button" class="modal-btn" :disabled="loading" @click="emit('cancel')">
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="modal-btn"
            :class="danger ? 'modal-btn--danger' : 'modal-btn--accent'"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  hint: { type: String, default: '' },
  confirmLabel: { type: String, required: true },
  cancelLabel: { type: String, required: true },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
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
</style>
