import { Clock3, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function QuickIndoorBreakCard() {
  return (
    <Card className="mini-card quick-break-card p-4">
      <div className="quick-break-copy">
        <p className="quick-label">Quick indoor break</p>
        <h2>Desk shoulder release</h2>
        <Badge className="quick-time" variant="success">
          <Clock3 size={13} />
          3 min
        </Badge>
        <p>Release tension and reset your shoulders.</p>
        <Button className="quick-break-button" size="sm" type="button">
          <Play size={15} fill="currentColor" />
          Start guided break
        </Button>
      </div>

      <div className="desk-stretch-art" aria-hidden="true">
        <span className="person person-left"></span>
        <span className="person person-right"></span>
        <span className="motion motion-left"></span>
        <span className="motion motion-right"></span>
      </div>
    </Card>
  )
}

export default QuickIndoorBreakCard
