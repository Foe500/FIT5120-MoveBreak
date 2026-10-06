import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Armchair,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Footprints,
  Pause,
  Play,
  SkipForward,
  Square,
  TimerReset,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import { clearIndoorBreakSession, saveIndoorBreakSession } from '@/lib/indoorBreak'
import {
  completeTeamBreakSessions,
  pauseTeamBreakSessions,
  resumeTeamBreakSessions,
  startTeamBreakSessions,
} from '@/lib/team'
import { formatActivityDuration } from '@/lib/activityDuration'
import { useActivityMusic } from '@/lib/useActivityMusic'
import BlurText from '@/components/react-bits/BlurText'
import ClickSpark from '@/components/react-bits/ClickSpark'
import CountUp from '@/components/react-bits/CountUp'
import Magnet from '@/components/react-bits/Magnet'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function IndoorGuidedBreak() {
  const location = useLocation()
  const { activityId } = useParams()
  const [activity, setActivity] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepSecondsLeft, setStepSecondsLeft] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [teamBreakSessions, setTeamBreakSessions] = useState([])
  const hasCompletedTeamBreakSessions = useRef(false)
  const {
    isMusicEnabled,
    musicError,
    pauseMusic,
    playMusic,
    resetMusic,
    toggleMusic,
  } = useActivityMusic()

  useEffect(() => {
    async function loadActivity() {
      resetMusic()

      try {
        const response = await fetch(`${API_BASE_URL}/activities/${activityId}`)

        if (!response.ok) {
          throw new Error('Failed to load guided activity')
        }

        const data = await response.json()
        const nextSteps = data.steps ?? []

        setActivity(data)
        setCurrentStepIndex(0)
        setStepSecondsLeft(nextSteps[0]?.seconds ?? 0)
        setIsTimerRunning(false)
        setIsComplete(false)
        setTeamBreakSessions([])
        hasCompletedTeamBreakSessions.current = false
        saveIndoorBreakSession({
          label: data.title,
          path: `${location.pathname}${location.search}`,
          type: 'Indoor guided break',
        })
      } catch {
        setError('Guided break details are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadActivity()
  }, [activityId, location.pathname, location.search, resetMusic])

  const steps = useMemo(() => activity?.steps ?? [], [activity])
  const currentStepDurationSeconds = steps[currentStepIndex]?.seconds ?? 0
  const totalSeconds = steps.reduce((sum, step) => sum + step.seconds, 0)
  const remainingStepsSeconds = steps
    .slice(currentStepIndex + 1)
    .reduce((sum, step) => sum + step.seconds, 0)
  const remainingSeconds = isComplete ? 0 : Math.max(0, remainingStepsSeconds + stepSecondsLeft)
  const progressPercent = totalSeconds
    ? Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)
    : 0
  const currentStep = steps[currentStepIndex]?.text ?? 'Ready to begin.'

  useEffect(() => {
    if (isComplete && activity && !hasCompletedTeamBreakSessions.current) {
      resetMusic()
      hasCompletedTeamBreakSessions.current = true
      completeTeamBreakSessions(teamBreakSessions)
      clearIndoorBreakSession()
    }
    // Only log once per completion, not on every render while complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  useEffect(() => {
    if (!isTimerRunning || isComplete || !currentStepDurationSeconds) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setStepSecondsLeft((secondsLeft) => {
        if (secondsLeft > 1) {
          return secondsLeft - 1
        }

        if (currentStepIndex >= steps.length - 1) {
          setIsTimerRunning(false)
          setIsComplete(true)
          return 0
        }

        // Move to the next guided step when the current step timer reaches zero.
        const nextIndex = currentStepIndex + 1
        setCurrentStepIndex(nextIndex)
        return steps[nextIndex].seconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentStepIndex, isComplete, isTimerRunning, currentStepDurationSeconds, steps])

  async function ensureTeamBreakSessions() {
    if (teamBreakSessions.length || !activity || !totalSeconds) {
      return teamBreakSessions
    }

    const sessions = await startTeamBreakSessions({
      setting: 'Indoor',
      label: activity.title,
      plannedSeconds: totalSeconds,
    })
    setTeamBreakSessions(sessions)
    return sessions
  }

  async function handleStartPause() {
    if (isComplete) {
      playMusic({ restart: true })
      saveIndoorBreakSession({
        label: activity?.title ?? 'Indoor guided break',
        path: `${location.pathname}${location.search}`,
        type: 'Indoor guided break',
      })
      setCurrentStepIndex(0)
      setStepSecondsLeft(steps[0]?.seconds ?? 0)
      setIsComplete(false)
      setTeamBreakSessions([])
      hasCompletedTeamBreakSessions.current = false
      await startTeamBreakSessions({
        setting: 'Indoor',
        label: activity?.title ?? 'Indoor guided break',
        plannedSeconds: totalSeconds,
      }).then(setTeamBreakSessions)
      setIsTimerRunning(true)
      return
    }

    if (isTimerRunning) {
      pauseMusic()
      await pauseTeamBreakSessions(teamBreakSessions)
      setIsTimerRunning(false)
      return
    }

    playMusic()
    const sessions = await ensureTeamBreakSessions()
    await resumeTeamBreakSessions(sessions)
    setIsTimerRunning(true)
  }

  function handleSkipStep() {
    if (isComplete) {
      return
    }

    if (currentStepIndex >= steps.length - 1) {
      resetMusic()
      setIsTimerRunning(false)
      setIsComplete(true)
      setStepSecondsLeft(0)
      return
    }

    const nextIndex = currentStepIndex + 1
    setCurrentStepIndex(nextIndex)
    setStepSecondsLeft(steps[nextIndex].seconds)
  }

  function handleFinish() {
    resetMusic()
    setIsTimerRunning(false)
    setIsComplete(true)
    setStepSecondsLeft(0)
  }

  if (isLoading) {
    return (
      <section className="page guided-break-page">
        <p className="activity-status-message">Loading guided break...</p>
      </section>
    )
  }

  if (error || !activity) {
    return (
      <section className="page guided-break-page">
        <Button asChild variant="outline">
          <Link to="/activities">
            <ArrowLeft size={16} />
            Back to library
          </Link>
        </Button>
        <p className="activity-status-message">{error || 'Guided break not found.'}</p>
      </section>
    )
  }

  return (
    <section className="page guided-break-page">
      <Button asChild className="activity-back-button" variant="outline">
        <Link to={`/activities/${activity.id}`}>
          <ArrowLeft size={16} />
          Back to activity detail
        </Link>
      </Button>

      <div className="guided-break-layout">
        <Card className="guided-break-main">
          <div className="guided-break-header">
            <div className="guided-break-status">
              <Badge variant="success">
                <Armchair size={13} />
                Indoor guided break
              </Badge>
              <Badge variant="secondary">
                <Clock3 size={13} />
                {formatActivityDuration(activity)}
              </Badge>
            </div>
            <Button
              aria-label={isMusicEnabled ? 'Turn music off' : 'Turn music on'}
              aria-pressed={isMusicEnabled}
              className="guided-music-toggle"
              onClick={() => toggleMusic(isTimerRunning && !isComplete)}
              size="sm"
              type="button"
              variant="outline"
            >
              {isMusicEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {isMusicEnabled ? 'Music on' : 'Music off'}
            </Button>
          </div>

          <h1>{activity.title}</h1>
          <p>{activity.description}</p>

          <div className="guided-timer-preview">
            <TimerReset size={42} strokeWidth={1.5} />
            <strong>{formatTime(remainingSeconds)}</strong>
            <span>{isComplete ? 'Break complete. Nice reset.' : currentStep}</span>
            <div className="guided-progress-track" aria-label="Guided break progress">
              <div style={{ width: `${progressPercent}%` }} />
            </div>
            <small><CountUp duration={0.35} to={progressPercent} />% complete</small>
          </div>

          <div className="guided-break-actions">
            <Button onClick={handleStartPause} type="button">
              {isTimerRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              {isComplete ? 'Restart' : isTimerRunning ? 'Pause' : 'Start'}
            </Button>
            <Button disabled={isComplete} onClick={handleSkipStep} type="button" variant="outline">
              <SkipForward size={16} />
              Skip
            </Button>
            <Button disabled={isComplete} onClick={handleFinish} type="button" variant="outline">
              <Square size={15} />
              Finish
            </Button>
          </div>

          {musicError ? (
            <p className="guided-music-status" role="status">{musicError}</p>
          ) : null}

          {isComplete ? (
            <ClickSpark
              duration={520}
              extraScale={1.15}
              sparkColor="#f06d52"
              sparkCount={10}
              sparkRadius={34}
              sparkSize={9}
              triggerKey={isComplete}
            >
              <div className="guided-completion-panel">
                <BlurText
                  animateBy="words"
                  as="strong"
                  delay={65}
                  direction="bottom"
                  stepDuration={0.24}
                  text="Break complete. Nice reset."
                />
                <p>You can return to the start or choose another indoor activity.</p>
                <div className="guided-completion-actions">
                  <Button asChild variant="outline">
                    <Link to="/">Back to Home</Link>
                  </Button>
                  <Magnet magnetStrength={4} padding={40}>
                    <Button asChild>
                      <Link to="/activities">Activity Library</Link>
                    </Button>
                  </Magnet>
                </div>
              </div>
            </ClickSpark>
          ) : null}
        </Card>

        <Card className="guided-break-steps">
          <div className="title-with-icon">
            <CheckCircle2 size={18} />
            <h2>Break steps</h2>
          </div>

          <ol>
            {steps.map((step, index) => (
              <li
                className={index === currentStepIndex && !isComplete ? 'active' : ''}
                key={step.text}
              >
                <span>{index + 1}</span>
                <p>{step.text}</p>
                <small>{formatTime(step.seconds)}</small>
              </li>
            ))}
          </ol>

          <p className="guided-break-note">
            <Footprints size={15} />
            Move gently and stop if anything feels uncomfortable.
          </p>
        </Card>
      </div>
    </section>
  )
}

export default IndoorGuidedBreak
