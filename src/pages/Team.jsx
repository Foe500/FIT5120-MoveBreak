import { useEffect, useState } from 'react'
import {
  Award,
  Check,
  Clock3 as PendingClockIcon,
  Copy,
  Crown,
  LogOut,
  Medal,
  PartyPopper,
  RefreshCw,
  Trophy,
  UserCheck,
  Users,
  X as RejectIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import {
  addMembership,
  addPendingRequest,
  getDeviceId,
  getMemberships,
  getPendingRequests,
  isJoined,
  leaveTeam,
  removePendingRequest,
  syncPendingRequests,
} from '@/lib/team'

function formatMinutes(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60)
  return `${minutes} min`
}

function formatTimeRemaining(endAtIso) {
  const remainingMs = new Date(endAtIso).getTime() - Date.now()
  if (remainingMs <= 0) {
    return 'Ending soon'
  }

  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000))
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} left`
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} left`
  }
  return 'Less than an hour left'
}

function TeamCreateJoinForm({ hasMemberships, onJoined }) {
  const [mode, setMode] = useState('create')
  const [teamName, setTeamName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function getResponseErrorMessage(response, fallback) {
    try {
      const body = await response.json()
      if (response.status === 429) {
        // Our rate-limit/lockout responses carry a specific, user-facing
        // reason ("Too many invalid join codes..." or "Rate limit
        // exceeded...") — show that instead of a generic failure message.
        return body.detail || body.error || fallback
      }
      return fallback
    } catch {
      return fallback
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!nickname.trim()) {
      setError('Enter a nickname.')
      return
    }

    setIsLoading(true)

    try {
      let code = joinCode.trim().toUpperCase()

      if (mode === 'create') {
        if (!teamName.trim()) {
          setError('Enter a team name.')
          setIsLoading(false)
          return
        }

        const createResponse = await fetch(`${API_BASE_URL}/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamName: teamName.trim(), deviceId: getDeviceId() }),
        })

        if (!createResponse.ok) {
          throw new Error(
            await getResponseErrorMessage(createResponse, 'Could not create the team right now.'),
          )
        }

        const createData = await createResponse.json()
        code = createData.joinCode
      } else {
        if (!code) {
          setError('Enter a join code.')
          setIsLoading(false)
          return
        }

        // Resolve the code to a team id before joining, so a code for a
        // team you're already on doesn't create a second, duplicate
        // membership under a different anonymous member id.
        const lookupResponse = await fetch(`${API_BASE_URL}/teams/${code}`)
        if (!lookupResponse.ok) {
          throw new Error(await getResponseErrorMessage(lookupResponse, 'Could not find that team.'))
        }
        const lookupData = await lookupResponse.json()
        if (isJoined(lookupData.id)) {
          setError("You're already on this team.")
          setIsLoading(false)
          return
        }
      }

      const joinResponse = await fetch(`${API_BASE_URL}/teams/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), deviceId: getDeviceId() }),
      })

      if (!joinResponse.ok) {
        throw new Error(
          await getResponseErrorMessage(
            joinResponse,
            mode === 'create' ? 'Failed to join the new team' : 'Could not find that team.',
          ),
        )
      }

      const joinData = await joinResponse.json()

      setTeamName('')
      setJoinCode('')
      setNickname('')

      if (joinData.status === 'approved') {
        // Only the team's own creator gets this immediately — everyone
        // else's "join" becomes a pending request below.
        const membership = {
          teamId: joinData.team.id,
          joinCode: joinData.team.joinCode,
          teamName: joinData.team.name,
          memberId: joinData.memberId,
          memberSecret: joinData.memberSecret,
          nickname: joinData.nickname,
        }
        addMembership(membership)
        onJoined({ type: 'joined', membership })
      } else {
        addPendingRequest({
          requestId: joinData.requestId,
          teamId: joinData.team.id,
          joinCode: joinData.team.joinCode,
          teamName: joinData.team.name,
          memberSecret: joinData.memberSecret,
        })
        onJoined({ type: 'pending' })
      }
    } catch (submitError) {
      setError(submitError.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="team-setup-card">
      <div className="title-with-icon">
        <Users size={18} />
        <h2>{hasMemberships ? 'Join another team' : 'Team up for your breaks'}</h2>
      </div>
      <p className="team-setup-description">
        Create or join a team to compete on a shared leaderboard. No account, no email, no
        real name required — just pick a nickname. You can be on more than one team at once;
        every break you finish counts toward all of them.
      </p>

      <div className="team-mode-tabs" role="tablist">
        <button
          className={mode === 'create' ? 'selected' : ''}
          onClick={() => setMode('create')}
          type="button"
        >
          Create a team
        </button>
        <button
          className={mode === 'join' ? 'selected' : ''}
          onClick={() => setMode('join')}
          type="button"
        >
          Join a team
        </button>
      </div>

      <form className="team-setup-form" onSubmit={handleSubmit}>
        {mode === 'create' ? (
          <label>
            Team name
            <input
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="e.g. Desk Warriors"
              type="text"
              value={teamName}
            />
          </label>
        ) : (
          <label>
            Join code
            <input
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="e.g. CPHUGW"
              type="text"
              value={joinCode}
            />
          </label>
        )}

        <label>
          Your nickname
          <input
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Shown only on your team's leaderboard"
            type="text"
            value={nickname}
          />
        </label>

        {error ? <p className="team-status-message">{error}</p> : null}

        <Button disabled={isLoading} type="submit">
          {isLoading ? 'Please wait...' : mode === 'create' ? 'Create team' : 'Join team'}
        </Button>
      </form>
    </Card>
  )
}

function rankIcon(index) {
  if (index === 0) return <Crown className="rank-icon gold" size={18} />
  if (index === 1) return <Medal className="rank-icon silver" size={18} />
  if (index === 2) return <Medal className="rank-icon bronze" size={18} />
  return <span className="rank-number">{index + 1}</span>
}

function PendingRequestCard({ pendingRequest, onDismiss }) {
  return (
    <Card className="pending-request-card">
      <div className="title-with-icon">
        <PendingClockIcon size={18} />
        <h2>{pendingRequest.teamName}</h2>
      </div>
      <p className="team-status-message pending">
        Request sent — waiting for the team's creator to approve you.
      </p>
      <Button onClick={onDismiss} size="sm" type="button" variant="outline">
        Cancel request
      </Button>
    </Card>
  )
}

function OwnerRequestsPanel({ joinCode, onDecision }) {
  const [requests, setRequests] = useState([])
  const [isOwner, setIsOwner] = useState(null)
  const [decidingId, setDecidingId] = useState('')

  async function loadRequests() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/teams/${joinCode}/join-requests?deviceId=${getDeviceId()}`,
      )
      if (response.status === 403) {
        setIsOwner(false)
        return
      }
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setIsOwner(true)
      setRequests(data.requests)
    } catch {
      // Try again on the next poll.
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadRequests, 0)
    const interval = window.setInterval(loadRequests, 8000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode])

  async function handleDecision(requestId, decision) {
    setDecidingId(requestId)
    try {
      await fetch(`${API_BASE_URL}/teams/${joinCode}/join-requests/${requestId}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      })
      await loadRequests()
      onDecision()
    } finally {
      setDecidingId('')
    }
  }

  if (!isOwner || !requests.length) {
    return null
  }

  return (
    <div className="owner-requests-panel">
      <div className="title-with-icon">
        <UserCheck size={16} />
        <h3>
          {requests.length} join request{requests.length === 1 ? '' : 's'} waiting
        </h3>
      </div>
      <ul className="owner-requests-list">
        {requests.map((request) => (
          <li key={request.id}>
            <span>{request.nickname}</span>
            <div>
              <Button
                disabled={decidingId === request.id}
                onClick={() => handleDecision(request.id, 'approve')}
                size="sm"
                type="button"
              >
                <Check size={14} />
                Approve
              </Button>
              <Button
                disabled={decidingId === request.id}
                onClick={() => handleDecision(request.id, 'reject')}
                size="sm"
                type="button"
                variant="outline"
              >
                <RejectIcon size={14} />
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TeamLeaderboard({ identity, onLeave }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)

  async function loadLeaderboard() {
    try {
      const response = await fetch(`${API_BASE_URL}/teams/${identity.joinCode}/leaderboard`)

      if (!response.ok) {
        throw new Error('Failed to load leaderboard')
      }

      const data = await response.json()
      setLeaderboard(data)
    } catch {
      setError('Leaderboard is unavailable right now.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(loadLeaderboard, 0)
    const interval = window.setInterval(loadLeaderboard, 15000)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.joinCode])

  function handleCopyCode() {
    navigator.clipboard?.writeText(identity.joinCode).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleRenew() {
    setIsRenewing(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/teams/${identity.joinCode}/seasons/renew`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to start a new week')
      }

      await loadLeaderboard()
    } catch {
      setError('Could not start the new week right now.')
    } finally {
      setIsRenewing(false)
    }
  }

  return (
    <Card className="team-leaderboard-card">
      <div className="team-leaderboard-header">
        <div className="title-with-icon">
          <Trophy size={18} />
          <h2>{identity.teamName}</h2>
        </div>
        <Button onClick={onLeave} size="sm" type="button" variant="outline">
          <LogOut size={14} />
          Leave team
        </Button>
      </div>

      <button className="team-join-code" onClick={handleCopyCode} type="button">
        <span>Join code</span>
        <strong>{identity.joinCode}</strong>
        <Copy size={14} />
        {copied ? <small>Copied!</small> : null}
      </button>

      <OwnerRequestsPanel joinCode={identity.joinCode} onDecision={loadLeaderboard} />

      {isLoading ? <p className="team-status-message">Loading leaderboard...</p> : null}
      {error ? <p className="team-status-message">{error}</p> : null}

      {leaderboard ? (
        <div className={`team-season-banner ${leaderboard.season.isActive ? 'active' : 'ended'}`}>
          <div>
            <strong>Week {leaderboard.season.weekNumber}</strong>
            {leaderboard.season.isActive ? (
              <span>{formatTimeRemaining(leaderboard.season.endAt)}</span>
            ) : leaderboard.season.winner ? (
              <span>
                <PartyPopper size={14} />
                {leaderboard.season.winner.nickname} won with {leaderboard.season.winner.points} pts!
              </span>
            ) : (
              <span>No sessions were logged this week.</span>
            )}
          </div>
          {!leaderboard.season.isActive ? (
            <Button disabled={isRenewing} onClick={handleRenew} size="sm" type="button">
              <RefreshCw size={14} />
              {isRenewing ? 'Starting...' : 'Start new week'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {leaderboard ? (
        <ol className="team-leaderboard-list">
          {leaderboard.members.map((member, index) => (
            <li
              className={member.memberId === identity.memberId ? 'you' : ''}
              key={member.memberId}
            >
              {rankIcon(index)}
              <div>
                <strong>
                  {member.nickname}
                  {member.memberId === identity.memberId ? ' (you)' : ''}
                  {member.championships > 0 ? (
                    <span className="championship-badge" title={`${member.championships} weekly win${member.championships === 1 ? '' : 's'}`}>
                      <Award size={13} />
                      {member.championships}
                    </span>
                  ) : null}
                </strong>
                <small>
                  {member.sessionsCompleted} session{member.sessionsCompleted === 1 ? '' : 's'} ·{' '}
                  {formatMinutes(member.totalSeconds)} moved
                </small>
              </div>
              <Badge variant="success">{member.points} pts</Badge>
            </li>
          ))}
        </ol>
      ) : null}

      {leaderboard && !leaderboard.members.length ? (
        <p className="team-status-message">
          No sessions logged yet. Finish a guided break to put points on the board.
        </p>
      ) : null}
    </Card>
  )
}

function Team() {
  const [memberships, setMemberships] = useState(() => getMemberships())
  const [pendingRequests, setPendingRequests] = useState(() => getPendingRequests())

  useEffect(() => {
    async function poll() {
      const didChange = await syncPendingRequests()
      if (didChange) {
        setMemberships(getMemberships())
        setPendingRequests(getPendingRequests())
      }
    }

    if (!pendingRequests.length) {
      return undefined
    }

    const interval = window.setInterval(poll, 5000)
    return () => window.clearInterval(interval)
  }, [pendingRequests.length])

  function handleJoined(result) {
    if (result.type === 'joined') {
      setMemberships(getMemberships())
    } else {
      setPendingRequests(getPendingRequests())
    }
  }

  async function handleLeave(teamId) {
    await leaveTeam(teamId)
    setMemberships(getMemberships())
  }

  function handleDismissPending(requestId) {
    removePendingRequest(requestId)
    setPendingRequests(getPendingRequests())
  }

  return (
    <section className="page team-page">
      <div className="team-heading">
        <h1>Team breaks</h1>
        <p>Move together, compete a little, and keep each other accountable.</p>
      </div>

      <div className="team-page-layout">
        <TeamCreateJoinForm hasMemberships={memberships.length > 0} onJoined={handleJoined} />

        {pendingRequests.map((pendingRequest) => (
          <PendingRequestCard
            key={pendingRequest.requestId}
            onDismiss={() => handleDismissPending(pendingRequest.requestId)}
            pendingRequest={pendingRequest}
          />
        ))}

        {memberships.map((membership) => (
          <TeamLeaderboard
            identity={membership}
            key={membership.teamId}
            onLeave={() => handleLeave(membership.teamId)}
          />
        ))}
      </div>
    </section>
  )
}

export default Team
