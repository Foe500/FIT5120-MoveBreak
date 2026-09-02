import { Clock3, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

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
        <Button className="w-fit" size="sm" type="button">
          <Play size={15} fill="currentColor" />
          Start guided break
        </Button>
      </div>

      <img
        className="desk-stretch-art"
        src={shoulderReleaseImage}
        alt="Person demonstrating a shoulder release stretch"
      />
    </Card>
  )
}

export default QuickIndoorBreakCard
