import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Footprints, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/lib/api'
import { getSavedPlannerBreaks, savePlannerBreaks } from '@/lib/plannerStorage'
import { checkPlanConflicts, localDateTime, plannerTimeZone, zonedIso } from '@/lib/assistant'

function Planner() {
  const location = useLocation()
  const navigate = useNavigate()
  const [assistantNotice, setAssistantNotice] = useState(() => location.state?.assistantPlan || null)
  const [plannedBreaks, setPlannedBreaks] = useState(() => getSavedPlannerBreaks())
  const [activities, setActivities] = useState([])
  const [activityId, setActivityId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const totalMinutes = plannedBreaks.reduce((sum, item) => sum + item.duration, 0)

  useEffect(() => {
    if (!location.state?.assistantPlan) return
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const firstId = assistantNotice?.itemIds?.find((id) => plannedBreaks.some((item) => item.id === id))
    if (!firstId) return
    const frame = requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      document.getElementById(`planner-item-${firstId}`)?.scrollIntoView({ behavior, block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [assistantNotice, plannedBreaks])

  useEffect(() => {
    const refresh = () => setPlannedBreaks(getSavedPlannerBreaks())
    window.addEventListener('movebreak:planner-change', refresh)
    window.addEventListener('storage', refresh)
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/activities`, { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Activity library is unavailable.')
      return response.json()
    }).then((data) => { setActivities(data); setLoading(false) }).catch((err) => {
      if (err.name !== 'AbortError') { setError('Could not load activities. Saved plans are still available.'); setLoading(false) }
    })
    return () => {
      controller.abort()
      window.removeEventListener('movebreak:planner-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  function save(items) {
    if (!savePlannerBreaks(items)) { setError('Your browser could not save the plan. Please check storage permissions.'); return false }
    setError('')
    return true
  }

  function edit(item) {
    setEditing(item)
    setActivityId(item.activityId || '')
    setStartTime(item.startAt ? localDateTime(item.startAt, item.timezone || plannerTimeZone) : '')
  }

  function submit(event) {
    event.preventDefault()
    try {
      const activity = activities.find((item) => item.id === activityId)
      if (!editing && !activity) throw new Error('Choose an activity.')
      const startAt = zonedIso(startTime)
      const duration = editing ? editing.duration : Math.ceil(Math.max(activity.duration, (activity.steps || []).reduce((sum, step) => sum + step.seconds, 0) / 60))
      const item = {
        ...(editing || {}), id: editing?.id || crypto.randomUUID(),
        activity: editing?.activity || activity.title, activityId: editing?.activityId || activity?.id,
        type: editing?.type || 'Indoor', duration,
        startAt, endAt: new Date(Date.parse(startAt) + duration * 60000).toISOString(),
        time: startTime.slice(11), date: startTime.slice(0, 10), timezone: plannerTimeZone,
        period: Number(startTime.slice(11, 13)) < 12 ? 'Morning' : 'Afternoon',
        status: 'Start', iconKey: editing?.iconKey || 'CalendarDays',
      }
      const existing = getSavedPlannerBreaks().filter((old) => old.id !== item.id)
      checkPlanConflicts([item], existing)
      if (save([...existing, item])) { setEditing(null); setStartTime('') }
    } catch (err) { setError(err.message) }
  }

  const dates = [...new Set(plannedBreaks.map((item) => item.date || 'Unscheduled'))].sort()
  return <section className="page planner-page">
    <div className="planner-heading">
      <div><h1>Plan your breaks</h1><p>Short breaks, at a time that works for you. Times shown in Melbourne time.</p></div>
      <div className="planner-heading-actions"><button type="button" onClick={() => save([])} disabled={!plannedBreaks.length}>Clear plan</button></div>
    </div>
    {assistantNotice && <div className="planner-agent-notice" role="status">
      <CheckCircle2 aria-hidden="true" size={21} />
      <div>
        <strong>{assistantNotice.addedCount > 0 ? `${assistantNotice.addedCount} ${assistantNotice.addedCount === 1 ? 'break' : 'breaks'} added to your plan` : 'Your plan is already up to date'}</strong>
        <span>{assistantNotice.addedCount > 0 ? 'MoveBreak checked the timing and saved your new schedule.' : 'Those breaks were already saved, so nothing was duplicated.'}</span>
      </div>
      <button type="button" aria-label="Dismiss plan update" onClick={() => setAssistantNotice(null)}><X size={17} /></button>
    </div>}
    {error && <p role="alert" className="activity-status-message">{error}</p>}
    <div className="planner-board-layout">
      <Card className="day-plan-card">
        <div className="day-plan-summary"><CalendarDays size={18} /><strong>{plannedBreaks.length} breaks planned</strong><span>{totalMinutes} minutes total</span></div>
        {!plannedBreaks.length && <div className="planner-day-section"><h2>A little space for yourself</h2><p>Add an activity here or ask the break assistant to suggest a plan.</p></div>}
        {dates.map((date) => <div key={date}>
          <h2 style={{ padding: '18px 20px 0' }}>{date}</h2>
          {['Morning', 'Afternoon'].map((period) => {
            const items = plannedBreaks.filter((item) => (item.date || 'Unscheduled') === date && item.period === period).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            if (!items.length) return null
            return <div className="planner-day-section" key={period}>
              <h3>{period}</h3>
              {items.map((item) => <article className={`planner-row${assistantNotice?.itemIds?.includes(item.id) ? ' planner-row-agent-added' : ''}`} id={`planner-item-${item.id}`} key={item.id}>
                <div className="planner-row-time"><span>{item.time}</span><i /></div>
                <div className="planner-row-card">
                  <span className="planner-row-icon">{item.type === 'Outdoor' ? <Footprints size={20} /> : <CalendarDays size={20} />}</span>
                  <div><h3>{item.activity}</h3><Badge variant={item.type === 'Outdoor' ? 'warning' : 'secondary'}>{item.type}</Badge></div>
                  <span className="planner-duration">{item.duration} min</span>
                  {item.activityId ? <Button asChild size="sm"><Link to={`/guided/indoor/${item.activityId}`}>Start</Link></Button>
                    : item.breakPlan ? <Button asChild size="sm"><Link to="/guided/outdoor" state={{ breakPlan: item.breakPlan }}>Start</Link></Button>
                      : item.directionsUrl ? <Button asChild size="sm"><a href={item.directionsUrl} rel="noreferrer" target="_blank">View route</a></Button> : null}
                  <div className="planner-row-actions">
                    <button aria-label={`Edit ${item.activity}`} onClick={() => edit(item)} type="button"><Pencil size={15} /></button>
                    <button aria-label={`Delete ${item.activity}`} onClick={() => save(getSavedPlannerBreaks().filter((old) => old.id !== item.id))} type="button"><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>)}
            </div>
          })}
        </div>)}
      </Card>
      <Card className="activity-add-panel">
        <h2>{editing ? 'Move your break' : 'Add an indoor activity'}</h2>
        <form onSubmit={submit} className="planner-edit-form">
          {editing ? <p>{editing.activity} · {editing.duration} min</p> : <label>Activity
            <select required value={activityId} onChange={(event) => setActivityId(event.target.value)} disabled={loading}>
              <option value="">{loading ? 'Loading activities…' : 'Choose an activity'}</option>
              {activities.map((item) => <option key={item.id} value={item.id}>{item.title} · {Math.ceil(Math.max(item.duration, (item.steps || []).reduce((sum, step) => sum + step.seconds, 0) / 60))} min</option>)}
            </select>
          </label>}
          <label>Start time · Australia/Melbourne<input type="datetime-local" lang="en-AU" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <Button type="submit" disabled={!editing && !activityId}><Plus size={16} />{editing ? 'Save new time' : 'Add to Planner'}</Button>
          {editing && <Button variant="outline" type="button" onClick={() => { setEditing(null); setStartTime('') }}>Cancel</Button>}
        </form>
        <Button asChild className="browse-activities-button" variant="outline"><Link to="/explore">Find an outdoor break</Link></Button>
        <Button asChild className="browse-activities-button" variant="outline"><Link to="/activities">Browse all activities</Link></Button>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 16 }}>Your plan is saved in this browser. Clear plan removes saved items. Chat history is not saved after a reload.</p>
      </Card>
    </div>
  </section>
}
export default Planner
