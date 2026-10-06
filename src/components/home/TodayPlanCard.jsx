import { useEffect, useState } from 'react'
import { getSavedPlannerBreaks } from '@/lib/plannerStorage'
import { localDateTime } from '@/lib/assistant'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function TodayPlanCard() {
  const [planItems, setPlanItems] = useState(() => getSavedPlannerBreaks())
  const [today] = useState(() => localDateTime(new Date()).slice(0, 10))
  useEffect(() => {
    const refresh = () => setPlanItems(getSavedPlannerBreaks())
    window.addEventListener('movebreak:planner-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('movebreak:planner-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const todaysItems = planItems.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time))
  return (
    <Card className="mini-card today-plan-card p-4">
      <CardHeader>
        <span className="icon-bubble">
          <CalendarDays size={18} />
        </span>
        <CardTitle>Today's plan</CardTitle>
      </CardHeader>

      <CardContent className="plan-timeline">
        {!todaysItems.length && <p>No breaks planned for today. Ask the assistant or add one in Planner.</p>}
        {todaysItems.map((item) => (
          <div className="plan-timeline-item" key={item.id}>
            <span className="timeline-dot"></span>
            <strong>{item.time}</strong>
            <div>
              <p>{item.activity}</p>
              <small>{item.duration} min</small>
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
