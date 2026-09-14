// Persists the currently running break in session storage so it can be resumed during this browser session.
export const activeBreakStorageKey = 'movebreak-active-break'

// Safely restore the in-progress break, treating malformed browser storage as empty.
export function getStoredActiveBreak() {
  try {
    return JSON.parse(sessionStorage.getItem(activeBreakStorageKey) ?? 'null')
  } catch {
    return null
  }
}

// Add a freshness timestamp, persist the new session and notify the shared banner immediately.
export function saveActiveBreakSession(session) {
  const nextSession = {
    ...session,
    updatedAt: Date.now(),
  }

  sessionStorage.setItem(activeBreakStorageKey, JSON.stringify(nextSession))
  window.dispatchEvent(new Event('movebreak:active-break-change'))

  return nextSession
}

// Remove the resumable session and notify any listeners that the break has ended.
export function clearActiveBreakSession() {
  sessionStorage.removeItem(activeBreakStorageKey)
  window.dispatchEvent(new Event('movebreak:active-break-change'))
}
