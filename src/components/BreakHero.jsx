import { useNavigate } from 'react-router-dom'
import { Footprints, Sparkles, TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'

const breakOptions = [5, 10, 15]

function BreakHero({ durationError, selectedDuration, onDurationChange, onMissingDuration }) {
  const navigate = useNavigate()

  function handleFindBreak() {
    // Stop the flow on Home until a duration is selected.
    if (!selectedDuration) {
      onMissingDuration()
      return
    }

    // Pass the selected duration to Mission so it can be applied automatically.
    navigate(`/mission?duration=${selectedDuration}`)
  }

  return (
    <>
      <div className="break-hero">
        <div className="round-illustration" aria-hidden="true">
          <Footprints size={38} />
        </div>
        <div>
          <h1>Ready for a short break?</h1>
          <p>Step away, reset and come back refreshed.</p>
        </div>
      </div>

      <div className="duration-tabs" aria-label="Choose break duration">
        {breakOptions.map((option) => (
          <button
            aria-pressed={option === selectedDuration}
            className={option === selectedDuration ? 'selected' : ''}
            key={option}
            onClick={() => onDurationChange(option)}
            type="button"
          >
            {option} min
          </button>
        ))}
      </div>

      {durationError ? (
        <p className="duration-error" role="alert">
          {durationError}
        </p>
      ) : null}

      <Button className="generate-button" onClick={handleFindBreak} type="button">
        <Sparkles size={17} />
        Find My Break
      </Button>

      <p className="time-note">
        <TimerReset size={15} />
        All missions are time-safe and easy to return from.
      </p>
    </>
  )
}

export default BreakHero
