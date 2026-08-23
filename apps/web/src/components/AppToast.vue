<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-relevant="additions">
      <TransitionGroup name="toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="toast-item"
          :class="`toast-item--${item.type}`"
          role="alert"
          @click="dismissToast(item.id)"
        >
          <span class="toast-icon" :class="`toast-icon--${item.type}`" aria-hidden="true">
            <svg
              v-if="item.type === 'error' || item.type === 'warning'"
              class="toast-mark"
              viewBox="0 0 12 12"
            >
              <rect x="4.85" y="1.6" width="2.3" height="5.4" rx="1.15" fill="currentColor" />
              <circle cx="6" cy="9.35" r="1.05" fill="currentColor" />
            </svg>
            <span v-else class="toast-char">{{ iconOf(item.type) }}</span>
          </span>
          <span class="toast-text">{{ item.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { dismissToast, useToastState } from '../composables/useToast'

const { toasts } = useToastState()

function iconOf(type) {
  if (type === 'success') return '✓'
  return 'i'
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: max(20px, env(safe-area-inset-top, 0px));
  left: 50%;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(420px, calc(100vw - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}
.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 5%, transparent),
    0 10px 28px color-mix(in srgb, var(--ink) 12%, transparent);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
  cursor: pointer;
}
.toast-icon {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--muted);
}
.toast-char {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}
.toast-mark {
  width: 11px;
  height: 11px;
  display: block;
}
.toast-text {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}
.toast-item--success .toast-icon {
  background: var(--success);
}
.toast-item--error .toast-icon {
  background: var(--error);
}
.toast-item--warning .toast-icon {
  background: #f59e0b;
}
.toast-item--info .toast-icon {
  background: var(--muted);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.toast-move {
  transition: transform 0.2s ease;
}
</style>
