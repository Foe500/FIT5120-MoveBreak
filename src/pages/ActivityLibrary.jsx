import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Armchair,
  CalendarPlus,
  Clock3,
  Dumbbell,
  Play,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { activityVisuals } from '@/data/activityVisuals'
import { API_BASE_URL } from '@/lib/api'

const durationFilters = [5, 15, 30, 'Any']
const postureFilters = ['Any posture', 'Seated', 'Standing']


function getInitialDuration(searchParams) {
  const duration = Number(searchParams.get('duration'))

  return durationFilters.includes(duration) ? duration : 'Any'
}

function ActivityLibrary() {
  const [searchParams] = useSearchParams()
  const [selectedDuration, setSelectedDuration] = useState(() => getInitialDuration(searchParams))
  const [selectedArea, setSelectedArea] = useState('All areas')
  const [selectedPosture, setSelectedPosture] = useState('Any posture')
  const [searchQuery, setSearchQuery] = useState('')
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
        const normalizedSearch = searchQuery.trim().toLowerCase()
        const searchableText = [
          activity.title,
          activity.area,
          activity.category,
          activity.description,
        ].join(' ').toLowerCase()
        const matchesArea = selectedArea === 'All areas' || activity.area === selectedArea
        // Duration means Noah should only see activities he can complete within his available time.
        const matchesDuration = selectedDuration === 'Any' || activity.duration <= selectedDuration
        const matchesPosture =
          selectedPosture === 'Any posture' || activity.posture === selectedPosture
        const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)

        return matchesArea && matchesDuration && matchesPosture && matchesSearch
      }),
    [activities, searchQuery, selectedArea, selectedDuration, selectedPosture],
  )

  function handleClearFilters() {
    setSearchQuery('')
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
          <input
            aria-label="Search activities"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search activities"
            type="search"
            value={searchQuery}
          />
        </label>

        <select
          aria-label="Filter by body area"
          className="activity-filter-select"
          onChange={(event) => setSelectedArea(event.target.value)}
          value={selectedArea}
        >
          {areaOptions.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by duration"
          className="activity-filter-select"
          onChange={(event) => setSelectedDuration(event.target.value === 'Any' ? 'Any' : Number(event.target.value))}
          value={selectedDuration}
        >
          {durationFilters.map((filter) => (
            <option key={filter} value={filter}>
              {filter === 'Any' ? 'Any duration' : `${filter} min`}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by posture"
          className="activity-filter-select"
          onChange={(event) => setSelectedPosture(event.target.value)}
          value={selectedPosture}
        >
          {postureFilters.map((filter) => (
            <option key={filter} value={filter}>
              {filter}
            </option>
          ))}
        </select>

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
                  <img src={visual.image} alt={visual.alt} width="600" height="600" loading="lazy" decoding="async" />
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

                <Button asChild className="mt-[0.55rem] w-full" size="sm">
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
