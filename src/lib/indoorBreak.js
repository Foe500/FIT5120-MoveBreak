// Wraps the shared active-break store with helpers specific to indoor guided sessions.
import {
  clearActiveBreakSession,
  getStoredActiveBreak,
  saveActiveBreakSession,
} from './activeBreak'

// Return the shared session only when it belongs to an indoor guided break.
export function getStoredIndoorBreak() {
  const activeBreak = getStoredActiveBreak()

  return activeBreak?.setting === 'Indoor' ? activeBreak : null
}

// Mark the supplied session as indoor before delegating persistence to the shared store.
export function saveIndoorBreakSession(session) {
  return saveActiveBreakSession({
    ...session,
    setting: 'Indoor',
  })
}

// Clear the shared session once the indoor flow is completed or abandoned.
export function clearIndoorBreakSession() {
  clearActiveBreakSession()
}
