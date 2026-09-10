import { useEffect, useState } from 'react'
import { Copy, Crown, LogOut, Medal, Trophy, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import { clearTeamIdentity, getTeamIdentity, saveTeamIdentity } from '@/lib/team'

function formatMinutes(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60)
  return `${minutes} min`
}

function TeamCreateJoinForm({ onJoined }) {
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
      }

      if (!code) {
        setError('Enter a join code.')
        setIsLoading(false)
        return
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

      saveTeamIdentity({
        joinCode: joinData.team.joinCode,
        teamName: joinData.team.name,
        memberId: joinData.memberId,
        nickname: joinData.nickname,
      })

      onJoined()
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
        <h2>Team up for your breaks</h2>
      </div>
      <p className="team-setup-description">
        Create or join a team to compete on a shared leaderboard. No account, no email, no
        real name required — just pick a nickname.
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

  useEffect(() => {
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

    loadLeaderboard()
    const interval = window.setInterval(loadLeaderboard, 15000)
    return () => window.clearInterval(interval)
  }, [identity.joinCode])

  function handleCopyCode() {
    navigator.clipboard?.writeText(identity.joinCode).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
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
  const [identity, setIdentity] = useState(() => getTeamIdentity())

  function handleLeave() {
    clearTeamIdentity()
    setIdentity(null)
  }

  return (
    <section className="page team-page">
      <div className="team-heading">
        <h1>Team breaks</h1>
        <p>Move together, compete a little, and keep each other accountable.</p>
      </div>

      {identity ? (
        <TeamLeaderboard identity={identity} onLeave={handleLeave} />
      ) : (
        <TeamCreateJoinForm onJoined={() => setIdentity(getTeamIdentity())} />
      )}
    </section>
  )
}

export default Team
