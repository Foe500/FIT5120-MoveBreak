import { Link } from 'react-router-dom'
import { CalendarDays, Clock3, MapPin, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import greenSpaceImage from '@/assets/home/green-space-reset.jpg'

function RecommendedMissionCard() {
  return (
    <Card className="mission-recommendation">
      <img
        className="park-art"
        src={greenSpaceImage}
        alt="Tree-lined walking path beside Melbourne city"
      />
      <div className="recommendation-copy">
        <Badge className="recommend-badge" variant="success">Recommended</Badge>
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
          <Button asChild size="sm">
            <Link to="/mission">
              <Play size={16} fill="currentColor" />
              Start Break
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/explore">
              <MapPin size={16} />
              View on Map
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default RecommendedMissionCard
