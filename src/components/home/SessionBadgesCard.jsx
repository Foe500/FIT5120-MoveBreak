import { Award, Eye, Leaf } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const badges = [
  { icon: Leaf, title: 'Fresh Air', state: 'Earned', active: true },
  { icon: Eye, title: 'Eye Ease', state: 'In progress' },
  { icon: Award, title: 'Posture Reset', state: 'In progress' },
]

function SessionBadgesCard() {
  return (
    <Card className="mini-card session-badges-card p-4">
      <CardHeader>
        <span className="icon-bubble">
          <Award size={18} />
        </span>
        <CardTitle>This session</CardTitle>
      </CardHeader>

      <CardContent className="badge-card-row">
        {badges.map((badge) => {
          const Icon = badge.icon

          return (
            <div className={badge.active ? 'badge-card earned' : 'badge-card'} key={badge.title}>
              <Icon size={30} />
              <strong>{badge.title}</strong>
              <span>{badge.state}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default SessionBadgesCard
