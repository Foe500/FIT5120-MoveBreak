import {
  clearActiveBreakSession,
  getStoredActiveBreak,
  saveActiveBreakSession,
} from './activeBreak'

export function getStoredOutdoorBreak() {
  const activeBreak = getStoredActiveBreak()

  return activeBreak?.setting === 'Outdoor' ? activeBreak : null
}

export function saveOutdoorBreakSession(breakPlan, startedAt = Date.now()) {
  return saveActiveBreakSession({
    breakPlan,
    setting: 'Outdoor',
    startedAt,
  })
}

export function clearOutdoorBreakSession() {
  clearActiveBreakSession()
}
