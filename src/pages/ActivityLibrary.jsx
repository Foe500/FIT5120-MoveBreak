import { useState } from 'react'
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

const filters = ['2-5 min', '5-10 min', 'Any']
const postureFilters = ['Seated', 'Standing', 'Low intensity', 'Step-free']

const activities = [
  {
    id: 'eye-reset',
    area: 'Eyes',
    title: '20-20-20 eye reset',
    description: 'Give your eyes a distance break.',
    duration: 2,
    posture: 'Seated',
    icon: Eye,
  },
  {
    id: 'desk-shoulder-release',
    area: 'Shoulders',
    title: 'Desk shoulder release',
    description: 'Ease tension without leaving your chair.',
    duration: 3,
    posture: 'Seated',
    image: shoulderReleaseImage,
  },
  {
    id: 'seated-breathing',
    area: 'Breathing',
    title: 'Seated breathing reset',
    description: 'Slow down with a guided breathing rhythm.',
    duration: 5,
    posture: 'Seated',
    icon: Wind,
  },
  {
    id: 'wrist-hand-reset',
    area: 'Wrists',
    title: 'Wrist and hand reset',
    description: 'Gentle movement after keyboard work.',
    duration: 3,
    posture: 'Seated',
    icon: Hand,
  },
  {
    id: 'standing-posture',
    area: 'Posture',
    title: 'Standing posture reset',
    description: 'Reset your stance and upper body.',
    duration: 4,
    posture: 'Standing',
    icon: Footprints,
  },
  {
    id: 'low-impact-energy',
    area: 'Whole body',
    title: 'Low-impact energy boost',
    description: 'A short movement break for low energy.',
    duration: 5,
    posture: 'Standing',
    icon: Dumbbell,
  },
]

function ActivityLibrary() {
  const [selectedTime, setSelectedTime] = useState('2-5 min')
  const [selectedPosture, setSelectedPosture] = useState('Seated')

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
        <strong>{activities.length} activities</strong>
        <span>Recommended</span>
      </div>

      <div className="indoor-activity-grid">
        {activities.map((activity) => {
          const Icon = activity.icon

          return (
            <Card className="indoor-activity-card" key={activity.id}>
              <div className="activity-illustration">
                {activity.image ? (
                  <img src={activity.image} alt="" />
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
