import { useEffect, useState } from 'react'
import { Award, Copy, Crown, LogOut, Medal, PartyPopper, RefreshCw, Trophy, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import { addMembership, getMemberships, isJoined, leaveTeam } from '@/lib/team'

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
          body: JSON.stringify({ teamName: teamName.trim() }),
        })

        if (!createResponse.ok) {
          throw new Error('Failed to create team')
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
          throw new Error('Team not found')
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
        body: JSON.stringify({ nickname: nickname.trim() }),
      })

      if (!joinResponse.ok) {
        throw new Error(mode === 'create' ? 'Failed to join the new team' : 'Team not found')
      }

      const joinData = await joinResponse.json()

      const membership = {
        teamId: joinData.team.id,
        joinCode: joinData.team.joinCode,
        teamName: joinData.team.name,
        memberId: joinData.memberId,
        nickname: joinData.nickname,
      }
      addMembership(membership)

      setTeamName('')
      setJoinCode('')
      setNickname('')
      onJoined(membership)
    } catch {
      setError(mode === 'create' ? 'Could not create the team right now.' : 'Could not find that team.')
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

  function handleJoined() {
    setMemberships(getMemberships())
  }

  async function handleLeave(teamId) {
    await leaveTeam(teamId)
    setMemberships(getMemberships())
  }

  return (
    <section className="page team-page">
      <div className="team-heading">
        <h1>Team breaks</h1>
        <p>Move together, compete a little, and keep each other accountable.</p>
      </div>

      <div className="team-page-layout">
        <TeamCreateJoinForm hasMemberships={memberships.length > 0} onJoined={handleJoined} />

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
