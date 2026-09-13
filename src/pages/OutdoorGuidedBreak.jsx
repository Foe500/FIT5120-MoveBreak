import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Footprints,
  Leaf,
  Navigation,
  RotateCcw,
  Square,
  TimerReset,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clearOutdoorBreakSession,
  getStoredOutdoorBreak,
  saveOutdoorBreakSession,
} from '@/lib/outdoorBreak'
import { logTeamSession } from '@/lib/team'

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getOutdoorBreakSession(locationState) {
  if (locationState?.breakPlan) {
    return saveOutdoorBreakSession(locationState.breakPlan)
  }

  return getStoredOutdoorBreak()
}

function OutdoorGuidedBreak() {
  const location = useLocation()
  const navigate = useNavigate()
  const breakSession = useMemo(() => getOutdoorBreakSession(location.state), [location.state])
  const breakPlan = breakSession?.breakPlan
  const walkThereSeconds = (breakPlan?.walkThereMinutes ?? 0) * 60
  const restSeconds = (breakPlan?.restMinutes ?? 0) * 60
  const walkBackSeconds = (breakPlan?.walkBackMinutes ?? 0) * 60
  const bufferSeconds = (breakPlan?.bufferMinutes ?? 0) * 60
  const returnAtSeconds = walkThereSeconds + restSeconds
  const totalSeconds = returnAtSeconds + walkBackSeconds + bufferSeconds
  const [startedAt, setStartedAt] = useState(() => breakSession?.startedAt ?? Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hasArrived, setHasArrived] = useState(false)
  const [hasStartedReturn, setHasStartedReturn] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const hasReachedPlace = elapsedSeconds >= walkThereSeconds || hasArrived
  const shouldReturn = elapsedSeconds >= returnAtSeconds || hasStartedReturn
  const timerSeconds = shouldReturn
    ? Math.max(0, totalSeconds - elapsedSeconds)
    : Math.max(0, returnAtSeconds - elapsedSeconds)
  const progressPercent = totalSeconds
    ? Math.min(100, Math.round((Math.min(elapsedSeconds, totalSeconds) / totalSeconds) * 100))
    : 0
  const circleStyle = {
    background: `conic-gradient(#13b981 ${progressPercent * 3.6}deg, #e8f3ec 0deg)`,
  }

  useEffect(() => {
    if (!breakPlan || isComplete) {
      return undefined
    }

    const tick = () => {
      const nextElapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)

      setElapsedSeconds(nextElapsedSeconds)
      if (nextElapsedSeconds >= totalSeconds) {
        setIsComplete(true)
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)

    return () => window.clearInterval(interval)
  }, [breakPlan, isComplete, startedAt, totalSeconds])

  useEffect(() => {
    if (isComplete && breakPlan) {
      logTeamSession({
        setting: 'Outdoor',
        label: breakPlan.placeName,
        seconds: totalSeconds,
      })
    }
    // Log only once when this outdoor break completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  function handleReturnNow() {
    setHasStartedReturn(true)

    if (elapsedSeconds < returnAtSeconds) {
      setStartedAt(Date.now() - returnAtSeconds * 1000)
      setElapsedSeconds(returnAtSeconds)
    }
  }

  function handleArrived() {
    setHasArrived(true)

    if (elapsedSeconds < walkThereSeconds) {
      setStartedAt(Date.now() - walkThereSeconds * 1000)
      setElapsedSeconds(walkThereSeconds)
    }
  }

  function handleFinishBreak() {
    setElapsedSeconds(totalSeconds)
    setIsComplete(true)
    clearOutdoorBreakSession()
  }

  function handleRestart() {
    const nextStartedAt = Date.now()

    setStartedAt(nextStartedAt)
    setElapsedSeconds(0)
    setHasArrived(false)
    setHasStartedReturn(false)
    setIsComplete(false)
    saveOutdoorBreakSession(breakPlan, nextStartedAt)
  }

  if (!breakPlan) {
    return (
      <section className="page outdoor-session-page">
        <Button asChild variant="outline">
          <Link to="/explore">
            <ArrowLeft size={16} />
            Back to places
          </Link>
        </Button>
        <p className="activity-status-message">Choose an outdoor place before starting a break.</p>
      </section>
    )
  }

  return (
    <section className="page outdoor-session-page">
      <Button className="activity-back-button" onClick={() => navigate(-1)} type="button" variant="outline">
        <ArrowLeft size={16} />
        Back to place
      </Button>

      <div className="outdoor-session-shell">
        <p className="outdoor-session-kicker">{breakPlan.category}</p>
        <h1>{isComplete ? 'Outdoor break complete.' : breakPlan.placeName}</h1>
        <p className="outdoor-session-subtitle">
          {isComplete
            ? 'Nice reset. You stayed inside your planned break window.'
            : shouldReturn
              ? 'Time to head back. Finish when you return.'
              : 'MoveBreak will remind you when it is time to return.'}
        </p>

        <div className="outdoor-timer-ring" style={circleStyle}>
          <div>
            {isComplete ? (
              <CheckCircle2 size={54} />
            ) : shouldReturn ? (
              <Footprints size={54} />
            ) : (
              <Leaf size={54} />
            )}
            <strong>{isComplete ? 'Done' : formatClock(timerSeconds)}</strong>
            <span>{shouldReturn || isComplete ? 'Return window' : 'Until return time'}</span>
          </div>
        </div>

        <p className="outdoor-session-instruction">
          {isComplete
            ? 'You can find another place or restart this timer.'
            : shouldReturn
              ? 'Head back now. Your return walk and buffer are already included.'
              : hasReachedPlace
                ? `Take your break now. MoveBreak will tell you when to return. Estimated rest: ${breakPlan.restMinutes} min.`
                : `Head to the place first. If you arrive early, tap I arrived to start your rest time.`}
        </p>

        <div className="outdoor-session-dots" aria-label="Break progress">
          <span className="active">Walk</span>
          <span className={hasReachedPlace ? 'active' : ''}>Rest</span>
          <span className={shouldReturn ? 'active' : ''}>Return</span>
          <span className={isComplete ? 'active' : ''}>Done</span>
        </div>

        <div className="outdoor-session-actions">
          <Button asChild variant="outline">
            <a href={breakPlan.directionsUrl} rel="noreferrer" target="_blank">
              <Navigation size={17} />
              Directions
            </a>
          </Button>
          <Button
            disabled={isComplete || shouldReturn || hasReachedPlace}
            onClick={handleArrived}
            type="button"
            variant="outline"
          >
            <Leaf size={17} />
            I arrived
          </Button>
          <Button disabled={isComplete || shouldReturn} onClick={handleReturnNow} type="button" variant="outline">
            <TimerReset size={17} />
            Return now
          </Button>
          <Button disabled={isComplete} onClick={handleFinishBreak} type="button">
            <Square size={16} />
            Finish break
          </Button>
        </div>

        {isComplete ? (
          <div className="outdoor-session-complete-actions">
            <Button onClick={handleRestart} type="button" variant="outline">
              <RotateCcw size={16} />
              Restart
            </Button>
            <Button asChild>
              <Link to="/explore">Find another place</Link>
            </Button>
          </div>
        ) : null}

        <small className="outdoor-session-note">
          {breakPlan.walkThereMinutes} min there · {breakPlan.restMinutes} min rest · {breakPlan.walkBackMinutes} min back ·{' '}
          {breakPlan.bufferMinutes} min buffer
        </small>
      </div>
    </section>
  )
}

export default OutdoorGuidedBreak
