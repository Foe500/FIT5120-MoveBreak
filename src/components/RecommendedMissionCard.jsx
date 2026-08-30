import { Link } from 'react-router-dom'
import { CalendarDays, Clock3, MapPin, Play } from 'lucide-react'

function RecommendedMissionCard() {
  return (
    <article className="mission-recommendation">
      <div className="park-art" aria-hidden="true">
        <span className="path-line"></span>
      </div>
      <div className="recommendation-copy">
        <span className="recommend-badge">Recommended</span>
        <h2>Green Space Reset</h2>
        <p>A calming loop through greenery to reset your mind and body.</p>

        <div className="recommendation-meta">
          <span>
            <Clock3 size={18} />
            <strong>10 min</strong>
            Duration
          </span>
          <span>
            <CalendarDays size={18} />
            <strong>Today</strong>
            Expected return
          </span>
        </div>

        <div className="recommendation-actions">
          <Link className="blue-button" to="/mission">
            <Play size={16} fill="currentColor" />
            Start Break
          </Link>
          <Link className="outline-button" to="/explore">
            <MapPin size={16} />
            View on Map
          </Link>
        </div>
      </div>
    </article>
  )
}

export default RecommendedMissionCard
