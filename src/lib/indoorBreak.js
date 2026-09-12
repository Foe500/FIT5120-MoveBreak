export const indoorBreakStorageKey = 'movebreak-active-indoor-break'

export function getStoredIndoorBreak() {
  try {
    return JSON.parse(sessionStorage.getItem(indoorBreakStorageKey) ?? 'null')
  } catch {
    return null
  }
}

export function saveIndoorBreakSession(session) {
  sessionStorage.setItem(
    indoorBreakStorageKey,
    JSON.stringify({
      ...session,
      updatedAt: Date.now(),
    }),
  )
  window.dispatchEvent(new Event('movebreak:indoor-break-change'))
}

export function clearIndoorBreakSession() {
  sessionStorage.removeItem(indoorBreakStorageKey)
  window.dispatchEvent(new Event('movebreak:indoor-break-change'))
}
