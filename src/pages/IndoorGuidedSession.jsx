import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

function flattenSteps(activities) {
  return activities.flatMap((activity, activityIndex) =>
    activity.steps.map((step, stepIndex) => ({
      activityIndex,
      stepIndex,
      text: step.text,
      seconds: step.seconds,
    })),
  )
}

function IndoorGuidedSession() {
  const [searchParams] = useSearchParams()
  const activityIds = useMemo(
    () => (searchParams.get('ids') ?? '').split(',').filter(Boolean),
    [searchParams],
  )

  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [stepSecondsLeft, setStepSecondsLeft] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    async function loadSessionActivities() {
      if (!activityIds.length) {
        setError('No exercises were selected for this session.')
        setIsLoading(false)
        return
      }

      try {
        const responses = await Promise.all(
          activityIds.map((id) => fetch(`${API_BASE_URL}/activities/${id}`)),
        )

        if (responses.some((response) => !response.ok)) {
          throw new Error('Failed to load one or more session activities')
        }

        const data = await Promise.all(responses.map((response) => response.json()))
        const nextFlatSteps = flattenSteps(data)

        setActivities(data)
        setCurrentIndex(0)
        setStepSecondsLeft(nextFlatSteps[0]?.seconds ?? 0)
        setIsTimerRunning(false)
        setIsComplete(false)
      } catch {
        setError('This guided session is unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadSessionActivities()
    // Only re-run when the requested activity ids actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityIds.join(',')])

  const flatSteps = useMemo(() => flattenSteps(activities), [activities])
  const currentStepDurationSeconds = flatSteps[currentIndex]?.seconds ?? 0
  const totalSeconds = flatSteps.reduce((sum, step) => sum + step.seconds, 0)
  const remainingStepsSeconds = flatSteps
    .slice(currentIndex + 1)
    .reduce((sum, step) => sum + step.seconds, 0)
  const remainingSeconds = isComplete ? 0 : Math.max(0, remainingStepsSeconds + stepSecondsLeft)
  const progressPercent = totalSeconds
    ? Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)
    : 0

  const currentActivityIndex = flatSteps[currentIndex]?.activityIndex ?? 0
  const currentActivity = activities[currentActivityIndex]
  const currentStepText = flatSteps[currentIndex]?.text ?? 'Ready to begin.'

  useEffect(() => {
    if (isComplete && activities.length) {
      logTeamSession({
        setting: 'Indoor',
        label: `${activities.length}-exercise session`,
        seconds: totalSeconds,
      })
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

        if (currentIndex >= flatSteps.length - 1) {
          setIsTimerRunning(false)
          setIsComplete(true)
          return 0
        }

        // Move to the next step, which may belong to the next exercise.
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        return flatSteps[nextIndex].seconds
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentIndex, isComplete, isTimerRunning, currentStepDurationSeconds, flatSteps])

  function handleStartPause() {
    if (isComplete) {
      setCurrentIndex(0)
      setStepSecondsLeft(flatSteps[0]?.seconds ?? 0)
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

    if (currentIndex >= flatSteps.length - 1) {
      setIsTimerRunning(false)
      setIsComplete(true)
      setStepSecondsLeft(0)
      return
    }

    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setStepSecondsLeft(flatSteps[nextIndex].seconds)
  }

  function handleFinish() {
    setIsTimerRunning(false)
    setIsComplete(true)
    setStepSecondsLeft(0)
  }

  if (isLoading) {
    return (
      <section className="page guided-break-page">
        <p className="activity-status-message">Loading guided session...</p>
      </section>
    )
  }

  if (error || !activities.length) {
    return (
      <section className="page guided-break-page">
        <Button asChild variant="outline">
          <Link to="/mission">
            <ArrowLeft size={16} />
            Back to Find a break
          </Link>
        </Button>
        <p className="activity-status-message">{error || 'Guided session not found.'}</p>
      </section>
    )
  }

  return (
    <section className="page guided-break-page">
      <Button asChild className="activity-back-button" variant="outline">
        <Link to="/mission">
          <ArrowLeft size={16} />
          Back to Find a break
        </Link>
      </Button>

      <div className="guided-break-layout">
        <Card className="guided-break-main">
          <div className="guided-break-status">
            <Badge variant="success">
              <Armchair size={13} />
              Indoor guided session
            </Badge>
            <Badge variant="secondary">
              <Clock3 size={13} />
              {activities.length} exercise{activities.length === 1 ? '' : 's'}
            </Badge>
          </div>

          <h1>{isComplete ? 'Session complete' : currentActivity?.title}</h1>
          <p>{isComplete ? 'Nice work — you moved through the whole session.' : currentActivity?.description}</p>

          <div className="guided-timer-preview">
            <TimerReset size={42} strokeWidth={1.5} />
            <strong>{formatTime(remainingSeconds)}</strong>
            <span>{isComplete ? 'Session complete. Nice reset.' : currentStepText}</span>
            <div className="guided-progress-track" aria-label="Guided session progress">
              <div style={{ width: `${progressPercent}%` }} />
            </div>
            <small>
              {isComplete
                ? '100% complete'
                : `${progressPercent}% complete · Exercise ${currentActivityIndex + 1} of ${activities.length}`}
            </small>
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
              <strong>Session complete. Nice reset.</strong>
              <p>You moved through all {activities.length} exercises in this break.</p>
              <div>
                <Button asChild variant="outline">
                  <Link to="/">Back to Home</Link>
                </Button>
                <Button asChild>
                  <Link to="/mission">Find another break</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="guided-break-steps">
          <div className="title-with-icon">
            <CheckCircle2 size={18} />
            <h2>Session exercises</h2>
          </div>

          <ol className="session-activity-list">
            {activities.map((activity, activityIndex) => {
              const activityStatus = isComplete
                ? 'done'
                : activityIndex < currentActivityIndex
                  ? 'done'
                  : activityIndex === currentActivityIndex
                    ? 'active'
                    : 'upcoming'

              return (
                <li className={`session-activity ${activityStatus}`} key={activity.id}>
                  <div className="session-activity-header">
                    <span>{activityIndex + 1}</span>
                    <div>
                      <strong>{activity.title}</strong>
                      <small>
                        <Clock3 size={12} />
                        {formatTime(activity.steps.reduce((sum, step) => sum + step.seconds, 0))} total
                      </small>
                    </div>
                  </div>

                  <ul className="session-step-list">
                    {activity.steps.map((step, stepIndex) => {
                      const isCurrentStep =
                        !isComplete &&
                        activityIndex === currentActivityIndex &&
                        stepIndex === flatSteps[currentIndex]?.stepIndex
                      const isDoneStep =
                        activityStatus === 'done' ||
                        (activityIndex === currentActivityIndex && stepIndex < (flatSteps[currentIndex]?.stepIndex ?? 0))

                      return (
                        <li
                          className={isCurrentStep ? 'active' : isDoneStep ? 'done' : ''}
                          key={step.text}
                        >
                          <p>{step.text}</p>
                          <small>{formatTime(step.seconds)}</small>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
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

export default IndoorGuidedSession
