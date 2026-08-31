import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair,
  CalendarPlus,
  Clock3,
  Dumbbell,
  Eye,
  Footprints,
  Hand,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wind,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'
import { API_BASE_URL } from '@/lib/api'

const filters = ['2-5 min', '5-10 min', 'Any']
const postureFilters = ['Seated', 'Standing', 'Low intensity', 'Step-free']

const activityVisuals = {
  'eye-reset': { icon: Eye },
  'desk-shoulder-release': { image: shoulderReleaseImage },
  'seated-breathing': { icon: Wind },
  'wrist-hand-reset': { icon: Hand },
  'standing-posture': { icon: Footprints },
  'low-impact-energy': { icon: Dumbbell },
}

function ActivityLibrary() {
  const [selectedTime, setSelectedTime] = useState('2-5 min')
  const [selectedPosture, setSelectedPosture] = useState('Seated')
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await fetch(`${API_BASE_URL}/activities`)

        if (!response.ok) {
          throw new Error('Failed to load activities')
        }

        const data = await response.json()
        setActivities(data)
      } catch {
        setError('Activities are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadActivities()
  }, [])

  return (
    <section className="page activities-page">
      <div className="activities-heading">
        <div>
          <h1>Indoor activity library</h1>
          <p>Short guided breaks for your desk or workspace.</p>
        </div>

        <Button asChild variant="outline">
          <Link to="/planner">
            <CalendarPlus size={17} />
            Open planner
          </Link>
        </Button>
      </div>

      <Card className="activity-filter-bar">
        <label className="activity-search-field">
          <Search size={17} />
          <span>Search activities</span>
        </label>

        <button className="area-filter" type="button">
          All areas
          <SlidersHorizontal size={15} />
        </button>

        <div className="activity-pill-group" aria-label="Duration filters">
          {filters.map((filter) => (
            <button
              className={filter === selectedTime ? 'selected' : ''}
              key={filter}
              onClick={() => setSelectedTime(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="activity-pill-group" aria-label="Posture filters">
          {postureFilters.map((filter) => (
            <button
              className={filter === selectedPosture ? 'selected' : ''}
              key={filter}
              onClick={() => setSelectedPosture(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>

        <button className="clear-filter-button" type="button">
          Clear filters
        </button>
      </Card>

      <div className="activity-toolbar-row">
        <strong>{isLoading ? 'Loading activities' : `${activities.length} activities`}</strong>
        <span>Recommended</span>
      </div>

      {error ? <p className="activity-status-message">{error}</p> : null}

      <div className="indoor-activity-grid" aria-busy={isLoading}>
        {activities.map((activity) => {
          const visual = activityVisuals[activity.id] ?? { icon: Dumbbell }
          const Icon = visual.icon

          return (
            <Card className="indoor-activity-card" key={activity.id}>
              <div className="activity-illustration">
                {visual.image ? (
                  <img src={visual.image} alt="" />
                ) : (
                  <Icon size={46} strokeWidth={1.35} />
                )}
              </div>

              <div className="indoor-activity-copy">
                <span className="activity-area">{activity.area}</span>
                <h2>{activity.title}</h2>
                <p>{activity.description}</p>

                <div className="activity-meta-row">
                  <span>
                    <Clock3 size={14} />
                    {activity.duration} min
                  </span>
                  <span>
                    <Armchair size={14} />
                    {activity.posture}
                  </span>
                </div>

                <Button className="activity-start-button" size="sm" type="button">
                  <Play size={14} fill="currentColor" />
                  Start now
                </Button>
                <Button className="activity-add-button" size="sm" type="button" variant="outline">
                  <CalendarPlus size={14} />
                  Add to planner
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <aside className="activity-safety-note">
        <Sparkles size={16} />
        <span>Move gently and stop if something feels uncomfortable.</span>
      </aside>
    </section>
  )
}

export default ActivityLibrary
