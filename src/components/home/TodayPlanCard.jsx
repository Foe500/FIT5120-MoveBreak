import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const planItems = [
  { time: '10:30', title: 'Eye reset', duration: '2 min' },
  { time: '15:00', title: 'Flagstaff Gardens walk', duration: '10 min' },
]

function TodayPlanCard() {
  return (
    <Card className="mini-card today-plan-card p-4">
      <CardHeader>
        <span className="icon-bubble">
          <CalendarDays size={18} />
        </span>
        <CardTitle>Today's plan</CardTitle>
      </CardHeader>

      <CardContent className="plan-timeline">
        {planItems.map((item) => (
          <div className="plan-timeline-item" key={`${item.time}-${item.title}`}>
            <span className="timeline-dot"></span>
            <strong>{item.time}</strong>
            <div>
              <p>{item.title}</p>
              <small>{item.duration}</small>
            </div>
          </div>
        ))}
      </CardContent>

      <Link className="small-link mt-auto w-fit" to="/planner">
        Open planner
      </Link>
    </Card>
  )
}

export default TodayPlanCard
