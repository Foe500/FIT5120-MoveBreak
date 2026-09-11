import { API_BASE_URL } from '@/lib/api'

const MEMBERSHIPS_KEY = 'movebreak_team_memberships'
const HISTORY_KEY = 'movebreak_team_history'

/**
 * This browser can belong to several teams at once. Each membership is
 * just {teamId, joinCode, teamName, memberId, nickname} — memberId is
 * an anonymous id the server generated, nothing that identifies a real
 * person. Completing a break logs to every team in this list.
 */
export function getMemberships() {
  try {
    const raw = window.localStorage.getItem(MEMBERSHIPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMemberships(memberships) {
  try {
    window.localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships))
  } catch {
    // localStorage may be unavailable (private browsing, storage disabled) — fail silently.
  }
}

export function isJoined(teamId) {
  return getMemberships().some((membership) => membership.teamId === teamId)
}

export function addMembership(membership) {
  const memberships = getMemberships()
  if (memberships.some((existing) => existing.teamId === membership.teamId)) {
    return
  }
  saveMemberships([...memberships, membership])
  addToTeamHistory(membership.teamId)
}

/**
 * A list of every team id this browser has ever joined, including ones
 * it has since left — used to scope the "your teams" overview to teams
 * the person actually has a connection to, not every team that exists.
 */
export function getTeamHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToTeamHistory(teamId) {
  try {
    const history = getTeamHistory()
    if (!history.includes(teamId)) {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, teamId]))
    }
  } catch {
    // Not critical — worst case the team just won't show in the overview list.
  }
}

/**
 * Tells the backend this member left the team so they disappear from
 * everyone else's leaderboard too, then drops the local membership
 * regardless of whether the request succeeded — the user should always
 * be able to leave from their own browser's point of view.
 */
export async function leaveTeam(teamId) {
  const memberships = getMemberships()
  const membership = memberships.find((existing) => existing.teamId === teamId)

  if (membership) {
    try {
      await fetch(`${API_BASE_URL}/teams/${membership.joinCode}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: membership.memberId }),
      })
    } catch {
      // Still drop the local membership even if the server call failed.
    }
  }

  saveMemberships(memberships.filter((existing) => existing.teamId !== teamId))
}

/**
 * Logs a completed break to every team this browser has joined. No-ops
 * quietly if there are none — logging is a bonus on top of the guided
 * break, never something that should block or interrupt it.
 */
export async function logTeamSession({ setting, label, seconds }) {
  const memberships = getMemberships()

  if (!memberships.length || !seconds) {
    return
  }

  await Promise.allSettled(
    memberships.map((membership) =>
      fetch(`${API_BASE_URL}/teams/${membership.joinCode}/log-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: membership.memberId,
          setting,
          label,
          seconds,
        }),
      }),
    ),
  )
}
