import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Play,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'
import { API_BASE_URL } from '@/lib/api'

function ActivityDetail() {
  const { activityId } = useParams()
  const [activity, setActivity] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadActivityDetail() {
      try {
        const response = await fetch(`${API_BASE_URL}/activities/${activityId}`)

        if (!response.ok) {
          throw new Error('Failed to load activity detail')
        }

        const data = await response.json()
        setActivity(data)
      } catch {
        setError('Activity details are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadActivityDetail()
  }, [activityId])

  if (isLoading) {
    return (
      <section className="page activity-detail-page">
        <p className="activity-status-message">Loading activity details...</p>
      </section>
    )
  }

  if (error || !activity) {
    return (
      <section className="page activity-detail-page">
        <Button asChild variant="outline">
          <Link to="/activities">
            <ArrowLeft size={16} />
            Back to library
          </Link>
        </Button>
        <p className="activity-status-message">{error || 'Activity not found.'}</p>
      </section>
    )
  }

  const steps = activity.steps ?? []
  const safetyNotes = activity.safetyNotes ?? []

  return (
    <section className="page activity-detail-page">
      <Button asChild className="activity-back-button" variant="outline">
        <Link to="/activities">
          <ArrowLeft size={16} />
          Back to library
        </Link>
      </Button>

      <div className="activity-detail-layout">
        <Card className="activity-detail-main">
          <div className="activity-detail-hero">
            <img src={shoulderReleaseImage} alt="" />
          </div>

          <div className="activity-detail-copy">
            <span className="activity-area">{activity.area}</span>
            <h1>{activity.title}</h1>
            <p>{activity.description}</p>

            <div className="activity-detail-badges">
              <Badge variant="secondary">
                <Clock3 size={13} />
                {activity.duration} min
              </Badge>
              <Badge variant="secondary">
                <Armchair size={13} />
                {activity.posture}
              </Badge>
              <Badge variant="secondary">
                <Tag size={13} />
                {activity.category}
              </Badge>
              <Badge variant="secondary">
                <Dumbbell size={13} />
                {activity.intensity}
              </Badge>
            </div>

            <Button className="activity-detail-start-button" type="button">
              <Play size={16} fill="currentColor" />
              Start Now
            </Button>

            {activity.demoInstruction ? (
              <p className="activity-demo-note">{activity.demoInstruction}</p>
            ) : null}
          </div>
        </Card>

        <div className="activity-detail-side">
          <Card className="activity-detail-panel">
            <div className="title-with-icon">
              <CheckCircle2 size={18} />
              <h2>Steps</h2>
            </div>
            <ol className="activity-step-list">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>

          <Card className="activity-detail-panel">
            <div className="title-with-icon">
              <ShieldCheck size={18} />
              <h2>Safety notes</h2>
            </div>
            <ul className="activity-safety-list">
              {safetyNotes.map((note) => (
                <li key={note}>
                  <AlertTriangle size={15} />
                  {note}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}

export default ActivityDetail
