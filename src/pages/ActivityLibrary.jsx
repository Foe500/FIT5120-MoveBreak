import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  Sparkles,
  Tag,
  Wind,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'
import { API_BASE_URL } from '@/lib/api'

const durationFilters = [5, 10, 15, 'Any']
const postureFilters = ['Any posture', 'Seated', 'Standing']

const activityVisuals = {
  'eye-reset': { icon: Eye },
  'desk-shoulder-release': { image: shoulderReleaseImage },
  'seated-breathing': { icon: Wind },
  'wrist-hand-reset': { icon: Hand },
  'standing-posture': { icon: Footprints },
  'low-impact-energy': { icon: Dumbbell },
}

function getInitialDuration(searchParams) {
  const duration = Number(searchParams.get('duration'))

  return durationFilters.includes(duration) ? duration : 'Any'
}

function ActivityLibrary() {
  const [searchParams] = useSearchParams()
  const [selectedDuration, setSelectedDuration] = useState(() => getInitialDuration(searchParams))
  const [selectedArea, setSelectedArea] = useState('All areas')
  const [selectedPosture, setSelectedPosture] = useState('Any posture')
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const areaOptions = useMemo(
    () => ['All areas', ...new Set(activities.map((activity) => activity.area))],
    [activities],
  )
  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const matchesArea = selectedArea === 'All areas' || activity.area === selectedArea
        // Duration means Noah should only see activities he can complete within his available time.
        const matchesDuration = selectedDuration === 'Any' || activity.duration <= selectedDuration
        const matchesPosture =
          selectedPosture === 'Any posture' || activity.posture === selectedPosture

        return matchesArea && matchesDuration && matchesPosture
      }),
    [activities, selectedArea, selectedDuration, selectedPosture],
  )

  function handleClearFilters() {
    setSelectedArea('All areas')
    setSelectedDuration('Any')
    setSelectedPosture('Any posture')
  }

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

        <select
          aria-label="Filter by body area"
          className="area-filter"
          onChange={(event) => setSelectedArea(event.target.value)}
          value={selectedArea}
        >
          {areaOptions.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>

        <div className="activity-pill-group" aria-label="Duration filters">
          {durationFilters.map((filter) => (
            <button
              className={filter === selectedDuration ? 'selected' : ''}
              key={filter}
              onClick={() => setSelectedDuration(filter)}
              type="button"
            >
              {filter === 'Any' ? 'Any' : `${filter} min`}
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

        <button className="clear-filter-button" onClick={handleClearFilters} type="button">
          Clear filters
        </button>
      </Card>

      <div className="activity-toolbar-row">
        <strong>
          {isLoading ? 'Loading activities' : `${filteredActivities.length} activities`}
        </strong>
        <span>Recommended</span>
      </div>

      {error ? <p className="activity-status-message">{error}</p> : null}
      {!isLoading && !error && filteredActivities.length === 0 ? (
        <p className="activity-status-message">No activities match the current filters.</p>
      ) : null}

      <div className="indoor-activity-grid" aria-busy={isLoading}>
        {filteredActivities.map((activity) => {
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
                  <span>
                    <Tag size={14} />
                    {activity.category}
                  </span>
                </div>

                <Button asChild className="activity-start-button" size="sm">
                  <Link to={`/activities/${activity.id}`}>
                    <Play size={14} fill="currentColor" />
                    View details
                  </Link>
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
