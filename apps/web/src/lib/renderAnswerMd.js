import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true
})

/**
 * 将助手回答 Markdown 转为可安全注入的 HTML（预览态）。
 */
export function renderAnswerHtml(markdown) {
  const src = typeof markdown === 'string' ? markdown : ''
  if (!src) return ''
  const raw = marked.parse(src, { async: false })
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true }
  })
}
