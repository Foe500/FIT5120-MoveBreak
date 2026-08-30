import { Link } from 'react-router-dom'
import { Footprints, Sparkles, TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'

const breakOptions = [5, 10, 15]

function BreakHero({ selectedDuration, onDurationChange }) {
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
            className={option === selectedDuration ? 'selected' : ''}
            key={option}
            onClick={() => onDurationChange(option)}
            type="button"
          >
            {option} min
          </button>
        ))}
      </div>

      <Button className="generate-button" asChild>
        <Link to="/mission">
          <Sparkles size={17} />
          Generate Mission
        </Link>
      </Button>

      <p className="time-note">
        <TimerReset size={15} />
        All missions are time-safe and easy to return from.
      </p>
    </>
  )
}

export default BreakHero
