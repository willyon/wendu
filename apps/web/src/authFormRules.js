/** 登录名：2–64 位，字母数字及 @._- */

const LOGIN_RE = /^[a-z0-9@._-]+$/

export function isLoginValid(value) {
  if (!value) return false
  const s = String(value).trim().toLowerCase()
  if (s.length < 2 || s.length > 64) return false
  return LOGIN_RE.test(s)
}

export function isPasswordLongEnough(value) {
  return typeof value === 'string' && value.length >= 6
}
