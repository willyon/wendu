import { computed, ref } from 'vue'
import {
  askQuestionStream,
  createConversation,
  deleteConversation as deleteConversationApi,
  listConversationMessages,
  listConversations,
  renameConversation as renameConversationApi
} from '../http/api'
import { apiMessage } from '../http/httpInstance'
import i18n from '../i18n'
import { toastError } from './useToast'

const STORAGE_KEY = 'wendu-active-conversation'

const messages = ref([])
const conversations = ref([])
const activeConversationId = ref('')
const sending = ref(false)
const restoredDraft = ref(null)
let abortController = null

function buildPairs(list) {
  const out = []
  let pendingQ = null
  for (const m of list) {
    if (m.role === 'user') pendingQ = m.content
    else if (m.role === 'assistant' && pendingQ != null) {
      out.push({
        question: pendingQ,
        answer: {
          type: m.type || 'answer',
          content: m.content,
          message: m.message || '',
          citations: m.citations || [],
          streaming: Boolean(m.streaming)
        }
      })
      pendingQ = null
    }
  }
  if (pendingQ) {
    out.push({
      question: pendingQ,
      answer: null
    })
  }
  return out
}

function isAbortError(err) {
  return err?.code === 'ABORTED' || err?.name === 'AbortError'
}

function persistActiveId(id) {
  if (id) localStorage.setItem(STORAGE_KEY, id)
  else localStorage.removeItem(STORAGE_KEY)
}

function noEvidenceMessage() {
  return i18n.global.t('askNoEvidence')
}

function applyNoEvidenceReply(assistantIdx, message) {
  const msg = messages.value[assistantIdx]
  if (!msg) return false
  msg.type = 'no_evidence'
  msg.content = ''
  msg.message = message || noEvidenceMessage()
  msg.citations = []
  msg.streaming = false
  return true
}

async function refreshAfterStop() {
  await new Promise((r) => setTimeout(r, 250))
  if (sending.value) return
  try {
    await loadConversations()
    if (activeConversationId.value) {
      const hist = await listConversationMessages(activeConversationId.value)
      messages.value = hist.messages
    }
  } catch {
    /* 保留本地已出字 */
  }
}

async function loadConversations() {
  const data = await listConversations()
  conversations.value = data.conversations || []
}

async function loadMessages() {
  if (!activeConversationId.value) {
    messages.value = []
    return
  }
  const hist = await listConversationMessages(activeConversationId.value)
  messages.value = hist.messages
}

export function useAskSession() {
  const pairs = computed(() => buildPairs(messages.value))

  const hasThread = computed(() => pairs.value.some((p) => p.answer != null))

  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === activeConversationId.value)
  )

  const pendingQuestion = computed(() => {
    if (!sending.value) return ''
    const last = pairs.value[pairs.value.length - 1]
    if (last?.answer == null) return last?.question || ''
    return ''
  })

  function stop() {
    abortController?.abort()
  }

  async function init() {
    if (sending.value) return
    await loadConversations()
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && conversations.value.some((c) => c.id === saved)) {
      activeConversationId.value = saved
    } else if (conversations.value.length) {
      activeConversationId.value = conversations.value[0].id
      persistActiveId(activeConversationId.value)
    } else {
      await createNewConversation()
      return
    }
    await loadMessages()
  }

  async function createNewConversation() {
    if (sending.value) return
    const data = await createConversation()
    activeConversationId.value = data.id
    persistActiveId(data.id)
    messages.value = []
    await loadConversations()
  }

  async function switchConversation(id) {
    if (sending.value || !id || id === activeConversationId.value) return
    activeConversationId.value = id
    persistActiveId(id)
    await loadMessages()
  }

  async function removeConversation(id) {
    if (sending.value) return
    await deleteConversationApi(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeConversationId.value === id) {
      if (conversations.value.length) {
        await switchConversation(conversations.value[0].id)
      } else {
        await createNewConversation()
      }
    }
  }

  async function renameConversation(id, title) {
    if (sending.value || !id) return
    const data = await renameConversationApi(id, { title })
    await loadConversations()
    return data
  }

  async function submit(question, { fileIds = null } = {}) {
    const q = question.trim()
    if (!q || sending.value || !activeConversationId.value) return false

    sending.value = true
    abortController = new AbortController()
    messages.value.push({ role: 'user', content: q })

    const payload = {
      question: q,
      conversationId: activeConversationId.value
    }
    if (fileIds?.length) payload.fileIds = fileIds

    const assistantIdx = messages.value.length
    messages.value.push({
      role: 'assistant',
      type: 'answer',
      content: '',
      citations: [],
      streaming: true
    })

    let stopped = false

    try {
      const data = await askQuestionStream(payload, {
        signal: abortController.signal,
        onDelta(text) {
          const msg = messages.value[assistantIdx]
          if (msg) msg.content += text
        }
      })

      const msg = messages.value[assistantIdx]
      if (!msg) return false

      if (data.type === 'no_evidence') {
        applyNoEvidenceReply(assistantIdx, data.message || '')
      } else {
        msg.type = 'answer'
        msg.content = data.text || msg.content
        msg.citations = data.citations || []
      }
      msg.streaming = false
      await loadConversations()
      return true
    } catch (e) {
      if (isAbortError(e)) {
        stopped = true
        const msg = messages.value[assistantIdx]
        const text = msg?.content?.trim()
        if (!text) {
          messages.value.splice(assistantIdx, 1)
          const last = messages.value[messages.value.length - 1]
          if (last?.role === 'user' && last.content === q) {
            messages.value.pop()
          }
        } else if (msg) {
          msg.streaming = false
          msg.type = 'answer'
        }
        restoredDraft.value = { text: q, seq: Date.now() }
        return Boolean(text)
      }

      if (e?.code === 'ASK_TIMEOUT' || e?.code === 'NO_EVIDENCE' || e?.code === 'EMBED_FAILED') {
        if (applyNoEvidenceReply(assistantIdx, e.message)) {
          await loadConversations()
          return true
        }
      }

      messages.value.splice(assistantIdx, 1)
      const last = messages.value[messages.value.length - 1]
      if (last?.role === 'user' && last.content === q) {
        messages.value.pop()
      }
      toastError(apiMessage(e))
      return false
    } finally {
      sending.value = false
      abortController = null
      if (stopped) refreshAfterStop()
    }
  }

  return {
    messages,
    conversations,
    activeConversationId,
    activeConversation,
    pairs,
    hasThread,
    pendingQuestion,
    sending,
    restoredDraft,
    init,
    createNewConversation,
    switchConversation,
    removeConversation,
    renameConversation,
    submit,
    stop
  }
}
