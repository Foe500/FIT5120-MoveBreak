import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import { logTeamSession } from '@/lib/team'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function IndoorGuidedBreak() {
  const { activityId } = useParams()
  const [activity, setActivity] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepSecondsLeft, setStepSecondsLeft] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    async function loadActivity() {
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
      } catch {
        setError('Guided break details are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadActivity()
  }, [activityId])

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
    if (isComplete && activity) {
      logTeamSession({ setting: 'Indoor', label: activity.title, seconds: totalSeconds })
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

  function handleStartPause() {
    if (isComplete) {
      setCurrentStepIndex(0)
      setStepSecondsLeft(steps[0]?.seconds ?? 0)
      setIsComplete(false)
      setIsTimerRunning(true)
      return
    }

    setIsTimerRunning((running) => !running)
  }

  function handleSkipStep() {
    if (isComplete) {
      return
    }

    if (currentStepIndex >= steps.length - 1) {
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
          <div className="guided-break-status">
            <Badge variant="success">
              <Armchair size={13} />
              Indoor guided break
            </Badge>
            <Badge variant="secondary">
              <Clock3 size={13} />
              {activity.duration} min
            </Badge>
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
            <small>{progressPercent}% complete</small>
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

          {isComplete ? (
            <div className="guided-completion-panel">
              <strong>Break complete. Nice reset.</strong>
              <p>You can return to the start or choose another indoor activity.</p>
              <div>
                <Button asChild variant="outline">
                  <Link to="/">Back to Home</Link>
                </Button>
                <Button asChild>
                  <Link to="/activities">Activity Library</Link>
                </Button>
              </div>
            </div>
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
