export const outdoorBreakStorageKey = 'movebreak-active-outdoor-break'

export function getStoredOutdoorBreak() {
  try {
    return JSON.parse(sessionStorage.getItem(outdoorBreakStorageKey) ?? 'null')
  } catch {
    return null
  }
}

export function saveOutdoorBreakSession(breakPlan, startedAt = Date.now()) {
  const session = {
    breakPlan,
    startedAt,
  }

  sessionStorage.setItem(outdoorBreakStorageKey, JSON.stringify(session))
  window.dispatchEvent(new Event('movebreak:outdoor-break-change'))

  return session
}

export function clearOutdoorBreakSession() {
  sessionStorage.removeItem(outdoorBreakStorageKey)
  window.dispatchEvent(new Event('movebreak:outdoor-break-change'))
}
