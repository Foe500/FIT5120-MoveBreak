import { useState } from 'react'
import {
  Armchair,
  BatteryCharging,
  Clock3,
  Eye,
  Footprints,
  Leaf,
  Play,
  RotateCcw,
  Sparkles,
  Wind,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const categories = ['All', 'Indoor', 'Outdoor', 'Eye reset', 'Stretch']

const activities = [
  {
    id: 'desk-shoulder-release',
    title: 'Desk shoulder release',
    category: 'Stretch',
    setting: 'Indoor',
    duration: 3,
    energy: 'Low energy',
    description: 'Loosen neck and shoulder tension without leaving your desk.',
    icon: Armchair,
  },
  {
    id: 'eye-distance-reset',
    title: '20-20 eye reset',
    category: 'Eye reset',
    setting: 'Indoor',
    duration: 2,
    energy: 'Low energy',
    description: 'Look away from the screen and relax your eyes with a short distance focus.',
    icon: Eye,
  },
  {
    id: 'green-space-loop',
    title: 'Green space loop',
    category: 'Outdoor',
    setting: 'Outdoor',
    duration: 10,
    energy: 'Medium energy',
    description: 'Take a calm walk through a nearby green space and return on time.',
    icon: Leaf,
  },
  {
    id: 'fresh-air-block',
    title: 'Fresh air block',
    category: 'Outdoor',
    setting: 'Outdoor',
    duration: 5,
    energy: 'Low energy',
    description: 'Step outside briefly, reset your breathing and come back clearer.',
    icon: Wind,
  },
  {
    id: 'posture-reset',
    title: 'Posture reset',
    category: 'Stretch',
    setting: 'Indoor',
    duration: 4,
    energy: 'Low energy',
    description: 'Reset your sitting posture with a few gentle movement cues.',
    icon: RotateCcw,
  },
  {
    id: 'movement-boost',
    title: 'Movement boost',
    category: 'Indoor',
    setting: 'Indoor',
    duration: 5,
    energy: 'Medium energy',
    description: 'Add light movement when you feel your focus dropping.',
    icon: Footprints,
  },
]

function ActivityLibrary() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const visibleActivities =
    selectedCategory === 'All'
      ? activities
      : activities.filter(
          (activity) =>
            activity.category === selectedCategory || activity.setting === selectedCategory,
        )

  return (
    <section className="page activities-page">
      <div className="activities-heading">
        <div>
          <h1>Activity library</h1>
          <p>Browse short breaks for focus, posture, energy and outdoor reset moments.</p>
        </div>

        <Badge className="library-count" variant="secondary">
          {visibleActivities.length} activities
        </Badge>
      </div>

      <div className="library-layout">
        <div>
          <div className="library-filter-row" aria-label="Activity category filters">
            {categories.map((category) => (
              <button
                className={category === selectedCategory ? 'selected' : ''}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div className="activity-library-grid">
            {visibleActivities.map((activity) => {
              const Icon = activity.icon

              return (
                <Card className="library-activity-card" key={activity.id}>
                  <div className="activity-icon">
                    <Icon size={24} />
                  </div>

                  <div>
                    <div className="activity-card-topline">
                      <Badge variant={activity.setting === 'Outdoor' ? 'success' : 'secondary'}>
                        {activity.setting}
                      </Badge>
                      <span>
                        <Clock3 size={14} />
                        {activity.duration} min
                      </span>
                    </div>

                    <h2>{activity.title}</h2>
                    <p>{activity.description}</p>

                    <div className="activity-card-footer">
                      <span>
                        <BatteryCharging size={14} />
                        {activity.energy}
                      </span>
                      <Button size="sm" type="button">
                        <Play size={14} fill="currentColor" />
                        Start
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        <aside className="library-side-panel">
          <Card className="library-plan-card">
            <div className="title-with-icon">
              <Sparkles size={18} />
              <h2>Suggested set</h2>
            </div>
            <p>Use a gentle mix of eye, stretch and outdoor breaks during a study day.</p>

            <div className="suggested-stack">
              <span>Eye reset</span>
              <span>Desk shoulder release</span>
              <span>Green space loop</span>
            </div>
          </Card>

          <Card className="library-plan-card">
            <div className="title-with-icon">
              <Leaf size={18} />
              <h2>Outdoor focus</h2>
            </div>
            <p>Outdoor activities can later connect with open space and walking distance data.</p>
          </Card>
        </aside>
      </div>
    </section>
  )
}

export default ActivityLibrary
