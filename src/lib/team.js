import { API_BASE_URL } from '@/lib/api'

const STORAGE_KEY = 'movebreak_team_identity'

/**
 * Team identity lives only in this browser's localStorage: a team join
 * code, an anonymous member id the server generated, and the nickname
 * the person typed in. No personal data is collected or stored.
 */
export function getTeamIdentity() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTeamIdentity(identity) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // localStorage may be unavailable (private browsing, storage disabled) — fail silently.
  }
}

export function clearTeamIdentity() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if storage isn't available.
  }
}

/**
 * Logs a completed break to the team leaderboard if this browser has
 * joined a team. No-ops quietly otherwise — logging is a bonus on top
 * of the guided break, never something that should block or interrupt it.
 */
export async function logTeamSession({ setting, label, seconds }) {
  const identity = getTeamIdentity()

  if (!identity || !seconds) {
    return
  }

  try {
    await fetch(`${API_BASE_URL}/teams/${identity.joinCode}/log-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: identity.memberId,
        setting,
        label,
        seconds,
      }),
    })
  } catch {
    // Leaderboard logging failing shouldn't affect the guided break itself.
  }
}
