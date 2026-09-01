import { useEffect, useState } from 'react'
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
        setActivity(data)
      } catch {
        setError('Guided break details are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadActivity()
  }, [activityId])

  const steps = activity?.steps ?? []
  const stepDurationSeconds = steps.length
    ? Math.max(1, Math.round((activity.duration * 60) / steps.length))
    : 0
  const totalSeconds = stepDurationSeconds * steps.length
  const remainingSeconds = isComplete
    ? 0
    : Math.max(0, (steps.length - currentStepIndex - 1) * stepDurationSeconds + stepSecondsLeft)
  const progressPercent = totalSeconds
    ? Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)
    : 0
  const currentStep = steps[currentStepIndex] ?? 'Ready to begin.'

  useEffect(() => {
    if (!activity || !stepDurationSeconds) {
      return
    }

    setCurrentStepIndex(0)
    setStepSecondsLeft(stepDurationSeconds)
    setIsTimerRunning(false)
    setIsComplete(false)
  }, [activity, stepDurationSeconds])

  useEffect(() => {
    if (!isTimerRunning || isComplete || !stepDurationSeconds) {
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
        setCurrentStepIndex((stepIndex) => stepIndex + 1)
        return stepDurationSeconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentStepIndex, isComplete, isTimerRunning, stepDurationSeconds, steps.length])

  function handleStartPause() {
    if (isComplete) {
      setCurrentStepIndex(0)
      setStepSecondsLeft(stepDurationSeconds)
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

    setCurrentStepIndex((stepIndex) => stepIndex + 1)
    setStepSecondsLeft(stepDurationSeconds)
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
            <Button className="guided-start-button" onClick={handleStartPause} type="button">
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
                key={step}
              >
                <span>{index + 1}</span>
                <p>{step}</p>
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
