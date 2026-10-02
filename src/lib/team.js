import { API_BASE_URL } from '@/lib/api'

const MEMBERSHIPS_KEY = 'movebreak_team_memberships'
const HISTORY_KEY = 'movebreak_team_history'
const DEVICE_ID_KEY = 'movebreak_device_id'
const PENDING_REQUESTS_KEY = 'movebreak_pending_join_requests'

function randomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  // Fallback for browsers without crypto.randomUUID — still unguessable
  // enough for an anonymous local identifier, just not cryptographically ideal.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * A single anonymous id for this browser, created once and reused for
 * every team it ever creates or requests to join — separate from the
 * per-team memberId the server hands out, since this one has to exist
 * *before* any membership does (it's what proves "this request is mine"
 * while a join request is still pending, and what proves team ownership
 * for approving/rejecting others).
 */
export function getDeviceId() {
  try {
    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = randomId()
      window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
  } catch {
    return randomId()
  }
}

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
 * A join code no longer grants membership by itself — it creates a
 * pending request the team's creator has to approve. Each entry here is
 * {requestId, teamId, joinCode, teamName} for a request this browser is
 * still waiting on; once approved/rejected, syncPendingRequests() clears
 * it (promoting it into a real membership first, if approved).
 */
export function getPendingRequests() {
  try {
    const raw = window.localStorage.getItem(PENDING_REQUESTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePendingRequests(pendingRequests) {
  try {
    window.localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(pendingRequests))
  } catch {
    // localStorage may be unavailable — fail silently.
  }
}

export function addPendingRequest(pendingRequest) {
  const pendingRequests = getPendingRequests()
  if (pendingRequests.some((existing) => existing.teamId === pendingRequest.teamId)) {
    return
  }
  savePendingRequests([...pendingRequests, pendingRequest])
}

export function removePendingRequest(requestId) {
  savePendingRequests(getPendingRequests().filter((request) => request.requestId !== requestId))
}

/**
 * Polls every pending request this browser is waiting on. An approved
 * one gets promoted straight into a real membership and dropped from the
 * pending list; a rejected one is just dropped (the caller can show a
 * "declined" message from the poll result before this runs again).
 */
export async function syncPendingRequests() {
  const deviceId = getDeviceId()
  const pendingRequests = getPendingRequests()
  let didChange = false

  for (const pendingRequest of pendingRequests) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/teams/${pendingRequest.joinCode}/join-requests/${pendingRequest.requestId}?deviceId=${deviceId}`,
      )
      if (!response.ok) {
        continue
      }
      const data = await response.json()

      if (data.status === 'approved' && data.membership) {
        addMembership({
          teamId: data.membership.team.id,
          joinCode: data.membership.team.joinCode,
          teamName: data.membership.team.name,
          memberId: data.membership.memberId,
          nickname: data.membership.nickname,
        })
        removePendingRequest(pendingRequest.requestId)
        didChange = true
      } else if (data.status === 'rejected') {
        removePendingRequest(pendingRequest.requestId)
        didChange = true
      }
    } catch {
      // Leave it pending and try again on the next poll.
    }
  }

  return didChange
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
