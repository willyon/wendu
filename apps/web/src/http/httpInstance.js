/**
 * Axios 单例与拦截器（对齐相册 httpInstance）。
 * 成功体解包；失败归一为 { code, message }（message 来自后端按语言）。
 */
import axios from 'axios'
import i18n from '../i18n'

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 120_000
})

http.interceptors.request.use((config) => {
  const lang = i18n.global.locale?.value || 'zh'
  config.headers['X-Accept-Language'] = lang
  return config
})

http.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response
    }
    return response.data
  },
  (error) => {
    return Promise.reject(normalizeError(error))
  }
)

/**
 * @param {import('axios').AxiosError} error
 * @returns {{ code: string, message: string }}
 */
function normalizeError(error) {
  const fallback = i18n.global.t('REQUEST_FAILED')
  if (error?.code === 'ECONNABORTED') {
    return { code: 'ASK_TIMEOUT', message: fallback }
  }
  if (!error?.response) {
    return { code: 'REQUEST_FAILED', message: fallback }
  }
  const data = error.response.data || {}
  if (typeof data.code === 'string') {
    return {
      code: data.code,
      message: typeof data.message === 'string' && data.message ? data.message : fallback
    }
  }
  const status = error.response.status
  if (status === 401 || status === 403) {
    return { code: 'UNAUTHORIZED', message: data.message || fallback }
  }
  if (status === 409) {
    return { code: 'LOGIN_TAKEN', message: data.message || fallback }
  }
  if (status === 429) {
    return { code: 'REQUESTS_TOO_FREQUENT', message: data.message || fallback }
  }
  return { code: 'REQUEST_FAILED', message: fallback }
}

/** 接口错误展示文案（优先后端 message） */
export function apiMessage(err) {
  if (err && typeof err.message === 'string' && err.message) return err.message
  return i18n.global.t('REQUEST_FAILED')
}

/** 稳定错误码，供分支（如待激活） */
export function codeOf(err) {
  if (err && typeof err.code === 'string' && !err.response) return err.code
  if (err?.response?.data?.code) return err.response.data.code
  return 'REQUEST_FAILED'
}

/**
 * @param {string} method
 * @param {string} url
 * @returns {(data?: object, extraConfig?: import('axios').AxiosRequestConfig) => Promise<any>}
 */
export function httpCurry(method, url) {
  return (data = {}, extraConfig = {}) => {
    const m = method.toUpperCase()
    const config = { method: m, url, ...extraConfig }
    if (m === 'GET') {
      config.params = data
    } else if (m === 'DELETE') {
      if (data && Object.keys(data).length > 0) config.data = data
    } else {
      config.data = data
    }
    return http(config)
  }
}

export default http
