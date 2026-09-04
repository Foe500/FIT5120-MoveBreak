import { useNavigate } from 'react-router-dom'
import { ArrowRight, TimerReset } from 'lucide-react'
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
        <div>
          <h1>Take a quick movement break. Feel ready to work again.</h1>
          <p>Choose a short reset that fits your time, energy and space. No equipment needed.</p>
        </div>
      </div>

      <p className="duration-label">How much time do you have?</p>
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
        Find my break
        <ArrowRight size={17} />
      </Button>

      <p className="time-note">
        <TimerReset size={15} />
        You will be back at your desk on time.
      </p>
    </>
  )
}

export default BreakHero
