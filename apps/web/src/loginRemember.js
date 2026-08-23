const STORAGE_KEY = 'wendu:last-username'

export function getRememberedUsername() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function rememberUsername(value) {
  try {
    const name = (value || '').trim()
    if (name) localStorage.setItem(STORAGE_KEY, name)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore quota / private mode
  }
}
