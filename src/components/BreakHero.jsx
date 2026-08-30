import { Link } from 'react-router-dom'
import { Footprints, Sparkles } from 'lucide-react'

const breakOptions = [5, 10, 15]

function BreakHero() {
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
          <button className={option === 5 ? 'selected' : ''} key={option} type="button">
            {option} min
          </button>
        ))}
      </div>

      <Link className="blue-button generate-button" to="/mission">
        <Sparkles size={17} />
        Generate Mission
      </Link>

      <p className="time-note">All missions are time-safe and easy to return from.</p>
    </>
  )
}

export default BreakHero
