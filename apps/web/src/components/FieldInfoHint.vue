<template>
  <span class="hint" tabindex="0" :aria-label="text">
    <svg class="hint-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle class="hint-bg" cx="8" cy="8" r="8" />
      <circle class="hint-mark" cx="8" cy="5.2" r="0.95" />
      <rect class="hint-mark" x="7.15" y="7.1" width="1.7" height="5" rx="0.85" />
    </svg>
    <span class="hint-tip" role="tooltip">{{ text }}</span>
  </span>
</template>

<script setup>
defineProps({
  text: { type: String, required: true }
})
</script>

<style scoped>
.hint {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 6px;
  color: color-mix(in srgb, var(--muted) 88%, var(--ink));
  cursor: help;
  vertical-align: -0.12em;
  outline: none;
  flex-shrink: 0;
}
.hint-icon {
  width: 14px;
  height: 14px;
  display: block;
}
.hint-bg {
  fill: currentColor;
}
.hint-mark {
  fill: #fff;
}
.hint:hover,
.hint:focus-visible {
  color: var(--accent);
}
.hint-tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  z-index: 20;
  width: max-content;
  max-width: min(280px, 72vw);
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--ink);
  color: #f7f9f6;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 400;
  letter-spacing: 0.01em;
  text-align: left;
  white-space: normal;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 18%, transparent);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.14s ease,
    visibility 0.14s ease;
}
.hint-tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--ink);
}
.hint:hover .hint-tip,
.hint:focus-visible .hint-tip {
  opacity: 1;
  visibility: visible;
}
</style>
