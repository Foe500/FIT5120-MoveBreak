// Wraps the shared active-break store with helpers specific to outdoor break plans.
import {
  clearActiveBreakSession,
  getStoredActiveBreak,
  saveActiveBreakSession,
} from './activeBreak'

// Return the shared session only when it contains an outdoor break plan.
export function getStoredOutdoorBreak() {
  const activeBreak = getStoredActiveBreak()

  return activeBreak?.setting === 'Outdoor' ? activeBreak : null
}

// Store the chosen place plan and start time so outdoor guidance can survive navigation.
export function saveOutdoorBreakSession(breakPlan, startedAt = Date.now()) {
  return saveActiveBreakSession({
    breakPlan,
    setting: 'Outdoor',
    startedAt,
  })
}

// Clear the shared session once the outdoor flow is completed or abandoned.
export function clearOutdoorBreakSession() {
  clearActiveBreakSession()
}
