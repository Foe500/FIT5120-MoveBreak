import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  Footprints,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

const initialBreaks = [
  {
    id: 'eye-reset-morning',
    time: '10:30',
    activity: 'Eye reset',
    duration: 2,
    type: 'Indoor',
    period: 'Morning',
    status: 'Completed',
    iconKey: 'Eye',
  },
  {
    id: 'desk-shoulder-release',
    time: '14:00',
    activity: 'Desk shoulder release',
    duration: 3,
    type: 'Indoor',
    period: 'Afternoon',
    status: 'Start',
    iconKey: 'CalendarDays',
  },
  {
    id: 'flagstaff-loop',
    time: '15:30',
    activity: 'Flagstaff Gardens loop',
    duration: 15,
    type: 'Outdoor',
    period: 'Afternoon',
    status: 'View route',
    iconKey: 'Footprints',
  },
]

const plannerStorageKey = 'movebreak-planned-breaks'
const plannerIcons = {
  CalendarDays,
  Eye,
  Footprints,
}

const activitySuggestions = [
  {
    id: '20-20-20-eye-reset',
    title: '20-20-20 eye reset',
    duration: 2,
    type: 'Indoor',
    added: false,
    iconKey: 'Eye',
  },
  {
    id: 'desk-shoulder-release-suggestion',
    title: 'Desk shoulder release',
    duration: 3,
    type: 'Indoor',
    added: true,
    image: shoulderReleaseImage,
  },
  {
    id: 'seated-breathing-reset',
    title: 'Seated breathing reset',
    duration: 5,
    type: 'Indoor',
    added: false,
    iconKey: 'CalendarDays',
  },
]

function getInitialPlannedBreaks() {
  try {
    const savedBreaks = JSON.parse(localStorage.getItem(plannerStorageKey) ?? '[]')

    return Array.isArray(savedBreaks) && savedBreaks.length ? savedBreaks : initialBreaks
  } catch {
    return initialBreaks
  }
}

function Planner() {
  const [plannedBreaks, setPlannedBreaks] = useState(getInitialPlannedBreaks)
  const totalMinutes = plannedBreaks.reduce(
    (sum, plannedBreak) => sum + plannedBreak.duration,
    0,
  )

  useEffect(() => {
    localStorage.setItem(plannerStorageKey, JSON.stringify(plannedBreaks))
  }, [plannedBreaks])

  function addSuggestedBreak(activity) {
    const newBreak = {
      id: `${activity.id}-${plannedBreaks.length}`,
      time: '16:30',
      activity: activity.title,
      duration: activity.duration,
      type: activity.type,
      period: 'Afternoon',
      status: 'Start',
      iconKey: activity.iconKey ?? 'CalendarDays',
    }

    setPlannedBreaks([...plannedBreaks, newBreak])
  }

  function renderPlanSection(period) {
    const periodBreaks = plannedBreaks.filter((plannedBreak) => plannedBreak.period === period)

    return (
      <div className="planner-day-section">
        <h2>{period}</h2>

        {periodBreaks.map((plannedBreak) => {
          const Icon = plannerIcons[plannedBreak.iconKey] ?? CalendarDays

          return (
            <article className="planner-row" key={plannedBreak.id}>
              <div className="planner-row-time">
                <span>{plannedBreak.time}</span>
                <i className={plannedBreak.status === 'Completed' ? 'completed' : ''}></i>
              </div>

              <div className="planner-row-card">
                <span className="planner-row-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <h3>{plannedBreak.activity}</h3>
                  <Badge variant={plannedBreak.type === 'Outdoor' ? 'warning' : 'secondary'}>
                    {plannedBreak.type}
                  </Badge>
                </div>
                <span className="planner-duration">{plannedBreak.duration} min</span>
                {plannedBreak.directionsUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={plannedBreak.directionsUrl} rel="noreferrer" target="_blank">
                      {plannedBreak.status}
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    type="button"
                    variant={plannedBreak.status === 'Completed' ? 'ghost' : 'outline'}
                  >
                    {plannedBreak.status === 'Completed' ? (
                      <>
                        <CheckCircle2 size={15} />
                        Completed
                      </>
                    ) : (
                      plannedBreak.status
                    )}
                  </Button>
                )}
                <div className="planner-row-actions">
                  <button aria-label="Edit break" type="button">
                    <Pencil size={15} />
                  </button>
                  <button aria-label="Delete break" type="button">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        <button className="add-slot-button" type="button">
          <Plus size={15} />
          Add a {period.toLowerCase()} break
        </button>
      </div>
    )
  }

  return (
    <section className="page planner-page">
      <div className="planner-heading">
        <div>
          <h1>Plan today's breaks</h1>
          <p>Arrange a few small breaks for this visit.</p>
        </div>

        <div className="planner-heading-actions">
          <button type="button">Clear plan</button>
        </div>
      </div>

      <div className="planner-board-layout">
        <Card className="day-plan-card">
          <div className="day-plan-summary">
            <CalendarDays size={18} />
            <strong>{plannedBreaks.length} breaks planned</strong>
            <span>{totalMinutes} minutes total</span>
          </div>

          {renderPlanSection('Morning')}
          {renderPlanSection('Afternoon')}
        </Card>

        <Card className="activity-add-panel">
          <h2>Add an activity</h2>

          <div className="planner-segmented-control">
            <button className="selected" type="button">Indoor</button>
            <button type="button">Outdoor</button>
          </div>

          <label className="activity-search-box">
            <Search size={17} />
            <span>Search activities</span>
          </label>

          <div className="planner-tag-row">
            <span>2-5 min</span>
            <span>Seated</span>
            <span>Eyes</span>
            <span>Shoulders</span>
          </div>

          <div className="suggestion-list">
            {activitySuggestions.map((activity) => {
              const Icon = plannerIcons[activity.iconKey] ?? CalendarDays

              return (
                <article key={activity.id}>
                  <div className="suggestion-thumb">
                    {activity.image ? (
                      <img src={activity.image} alt="" />
                    ) : (
                      <Icon size={24} />
                    )}
                  </div>
                  <div>
                    <h3>{activity.title}</h3>
                    <p>{activity.duration} min</p>
                  </div>

                  {activity.added ? (
                    <span className="added-label">
                      <CheckCircle2 size={15} />
                      Added
                    </span>
                  ) : (
                    <Button
                      onClick={() => addSuggestedBreak(activity)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Add
                    </Button>
                  )}
                </article>
              )
            })}
          </div>

          <Button asChild className="browse-activities-button" variant="outline">
            <Link to="/activities">Browse all activities</Link>
          </Button>
        </Card>
      </div>
    </section>
  )
}

export default Planner
