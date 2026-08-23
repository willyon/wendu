/**
 * 后端 HTTP API（基于 httpCurry；按模块分块，路径集中在此）。
 */
import i18n from '../i18n'
import { httpCurry } from './httpInstance'

/** ============ Auth ============ */

export const login = (data) => httpCurry('post', '/auth/login')(data)
export const logout = () => httpCurry('post', '/auth/logout')()
export const getCurrentUser = () => httpCurry('get', '/auth/me')()

/** ============ Admin ============ */

export const adminGetSettings = () => httpCurry('get', '/admin/settings')()
export const adminSaveSettings = (data) => httpCurry('put', '/admin/settings')(data)
export const adminListUsers = () => httpCurry('get', '/admin/users')()
export const adminCreateUser = (data) => httpCurry('post', '/admin/users')(data)
export const adminResetUserPassword = (userId, data) =>
  httpCurry('put', `/admin/users/${userId}/password`)(data)
export const adminDeleteUser = (userId) => httpCurry('delete', `/admin/users/${userId}`)()
export const adminChangePassword = (data) => httpCurry('put', '/admin/me/password')(data)

/** ============ Files ============ */

export const listFiles = () => httpCurry('get', '/files')()
export const prepareUpload = (data) => httpCurry('post', '/files/prepare')(data)
export const completeUpload = (data) => httpCurry('post', '/files/complete')(data)
export const deleteFile = (fileId) => httpCurry('delete', `/files/${fileId}`)()

/** ============ Ask ============ */

export const listConversations = () => httpCurry('get', '/ask/conversations')()
export const createConversation = () => httpCurry('post', '/ask/conversations')()
export const renameConversation = (id, data) =>
  httpCurry('patch', `/ask/conversations/${id}`)(data)
export const deleteConversation = (id) => httpCurry('delete', `/ask/conversations/${id}`)()
export const listConversationMessages = (id) =>
  httpCurry('get', `/ask/conversations/${id}/messages`)()

function parseSseBlock(block) {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try {
    return { event, data: JSON.parse(data) }
  } catch {
    return null
  }
}

/**
 * SSE 流式提问。
 * @param {{ question: string, fileIds?: string[] }} payload
 * @param {{ signal?: AbortSignal, onDelta?: (text: string) => void, onDone?: (data: object) => void }} options
 */
export async function askQuestionStream(payload, { signal, onDelta, onDone } = {}) {
  const lang = i18n.global.locale?.value || 'zh'
  let res
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Accept-Language': lang,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(payload),
      signal
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw { code: 'ABORTED', name: 'AbortError' }
    }
    throw err
  }

  if (!res.ok) {
    let errBody = {}
    try {
      errBody = await res.json()
    } catch {
      /* ignore */
    }
    const fallback = i18n.global.t('REQUEST_FAILED')
    throw {
      code: errBody.code || 'REQUEST_FAILED',
      message: errBody.message || fallback
    }
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw { code: 'REQUEST_FAILED', message: i18n.global.t('REQUEST_FAILED') }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload = null

  while (true) {
    let chunk
    try {
      chunk = await reader.read()
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw { code: 'ABORTED', name: 'AbortError' }
      }
      throw err
    }
    const { done, value } = chunk
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const block of parts) {
      const parsed = parseSseBlock(block)
      if (!parsed) continue
      if (parsed.event === 'delta' && parsed.data.text) {
        onDelta?.(parsed.data.text)
      } else if (parsed.event === 'done') {
        donePayload = parsed.data
        onDone?.(parsed.data)
      } else if (parsed.event === 'error') {
        throw { code: parsed.data.code || 'REQUEST_FAILED', message: parsed.data.message || i18n.global.t('REQUEST_FAILED') }
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer)
    if (parsed?.event === 'delta' && parsed.data.text) onDelta?.(parsed.data.text)
    else if (parsed?.event === 'done') {
      donePayload = parsed.data
      onDone?.(parsed.data)
    } else if (parsed?.event === 'error') {
      throw { code: parsed.data.code || 'REQUEST_FAILED', message: parsed.data.message || i18n.global.t('REQUEST_FAILED') }
    }
  }

  if (!donePayload) {
    throw { code: 'REQUEST_FAILED', message: i18n.global.t('REQUEST_FAILED') }
  }
  return donePayload
}
