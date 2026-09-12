import {
  clearActiveBreakSession,
  getStoredActiveBreak,
  saveActiveBreakSession,
} from './activeBreak'

export function getStoredIndoorBreak() {
  const activeBreak = getStoredActiveBreak()

  return activeBreak?.setting === 'Indoor' ? activeBreak : null
}

export function saveIndoorBreakSession(session) {
  return saveActiveBreakSession({
    ...session,
    setting: 'Indoor',
  })
}

export function clearIndoorBreakSession() {
  clearActiveBreakSession()
}
