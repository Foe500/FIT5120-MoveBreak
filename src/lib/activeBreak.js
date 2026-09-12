export const activeBreakStorageKey = 'movebreak-active-break'

export function getStoredActiveBreak() {
  try {
    return JSON.parse(sessionStorage.getItem(activeBreakStorageKey) ?? 'null')
  } catch {
    return null
  }
}

export function saveActiveBreakSession(session) {
  const nextSession = {
    ...session,
    updatedAt: Date.now(),
  }

  sessionStorage.setItem(activeBreakStorageKey, JSON.stringify(nextSession))
  window.dispatchEvent(new Event('movebreak:active-break-change'))

  return nextSession
}

export function clearActiveBreakSession() {
  sessionStorage.removeItem(activeBreakStorageKey)
  window.dispatchEvent(new Event('movebreak:active-break-change'))
}
