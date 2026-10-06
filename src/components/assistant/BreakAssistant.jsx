import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUp, CalendarPlus, Check, MessageCircle, Sprout, X } from 'lucide-react'
import { assistantRequest, checkPlanConflicts, localDateTime, planIntervals, plannerTimeZone, zonedIso } from '@/lib/assistant'
import { addConfirmedPlannerItems, getSavedPlannerBreaks } from '@/lib/plannerStorage'
import './assistant.css'

const origins = {
  townhall: { latitude: -37.815, longitude: 144.9669 },
  docklands: { latitude: -37.818, longitude: 144.946 },
  southbank: { latitude: -37.823, longitude: 144.965 },
}
const errorText = {
  PLAN_CONFLICT: 'This plan conflicts with an existing break. Adjust the time and try again.', OUTSIDE_WINDOW: 'The whole activity must stay inside the original available window.',
  PAST_TIME: 'Choose a start time in the future.', PREVIEW_EXPIRED: 'This preview has expired. Generate a new plan.',
  AI_RATE_LIMIT: 'There are too many requests. Please try again shortly.', AI_TIMEOUT: 'The response timed out. Try again or browse the activity library.',
  AI_UNAVAILABLE: 'The assistant is temporarily unavailable. Please try again.', STORAGE_FAILED: 'The browser could not save your plan. Check its storage settings.',
  DURATION_CHANGED: 'The activity duration changed. Generate a new preview.', AI_DISABLED: 'The assistant is not enabled. You can still browse the activity library.',
}

const toolLabels = {
  recommend_break: 'Recommend break',
  create_plan_preview: 'Create plan preview',
  ask_clarification: 'Ask clarification',
  unsupported_request: 'Unsupported request',
}

function CandidateCard({ item, onSchedule, onNavigate }) {
  return <article className="assistant-candidate">
    <div className="assistant-candidate-meta"><span>{item.setting === 'Indoor' ? 'Indoor' : 'Outdoor · estimated'}</span><strong>{item.durationMinutes} min</strong></div>
    <h3>{item.title}</h3>
    <p>{item.reason}</p>
    <div className="assistant-card-actions">
      <button type="button" onClick={() => onNavigate(item)}>Start break</button>
      <button type="button" onClick={() => onSchedule(item)}><CalendarPlus size={14} />Schedule</button>
    </div>
  </article>
}

function previewEnd(time, duration) {
  try { return localDateTime(Date.parse(zonedIso(time)) + duration * 60000).replace('T', ' ') }
  catch { return '' }
}

function privacyText(status) {
  if (status?.mode === 'mock') return 'Messages stay with your local demo backend.'
  if (status?.mode === 'hybrid') {
    return status.providerAvailable
      ? `Simple requests stay local. Complex requests may be processed by ${status.provider || 'the configured AI provider'}.`
      : 'Simple requests stay local. AI fallback is not configured.'
  }
  return `Messages and recent conversation are processed by ${status?.provider || 'the configured AI provider'}.`
}

function PlanPreview({ items, onSaved }) {
  const [times, setTimes] = useState(() => items.map((item) => item.startAt ? localDateTime(item.startAt) : ''))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  async function confirm(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await assistantRequest('confirm', {
        items: items.map((item, i) => ({ token: item.token, startAt: zonedIso(times[i]) })),
        existingPlan: planIntervals(getSavedPlannerBreaks()),
      }, AbortSignal.timeout(20000))
      const addedCount = await addConfirmedPlannerItems(result.items, checkPlanConflicts)
      setSaved(true)
      onSaved?.({ items: result.items, addedCount })
    } catch (err) {
      setError(errorText[err.code] || err.message || 'The plan could not be added. Check the times and try again.')
    } finally { setBusy(false) }
  }
  return <form className="assistant-plan" onSubmit={confirm}>
    <p className="assistant-plan-label">Plan preview · Melbourne time</p>
    {items.map((item, i) => <div className="assistant-plan-item" key={item.token}>
      <strong>{item.title}</strong><span>{item.durationMinutes} min</span>
      {item.windowStart && <small>{localDateTime(item.windowStart).replace('T', ' ')} – {localDateTime(item.windowEnd).slice(11)}</small>}
      <label>Start time
        <input type="datetime-local" lang="en-AU" required value={times[i]} disabled={busy || saved}
          onChange={(event) => setTimes(times.map((time, index) => index === i ? event.target.value : time))} />
      </label>
      {times[i] && <small>End time: {previewEnd(times[i], item.durationMinutes)}</small>}
    </div>)}
    {error && <p className="assistant-error" role="alert">{error}</p>}
    <button className="assistant-primary" disabled={busy || saved} type="submit">
      {saved ? <Check size={16} /> : <CalendarPlus size={16} />}
      {saved ? 'Opening Planner…' : busy ? 'Checking and adding…' : 'Confirm & open Planner'}
    </button>
  </form>
}

export default function BreakAssistant() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [turns, setTurns] = useState([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState('')
  const [schedule, setSchedule] = useState(null)
  const inputRef = useRef(null)
  const logRef = useRef(null)
  const launcherRef = useRef(null)
  const wasOpenRef = useRef(false)
  const controllerRef = useRef(null)
  const navigate = useNavigate()
  const showOrigin = Boolean(origin) || turns.some((turn) => turn.result?.constraints?.setting === 'Outdoor')

  useEffect(() => () => controllerRef.current?.abort(), [])
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const controller = new AbortController()
    assistantRequest('status', null, controller.signal).then(setStatus).catch(() => {})
    return () => controller.abort()
  }, [open])
  useEffect(() => {
    if (open) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy, schedule, open])
  useEffect(() => {
    if (wasOpenRef.current && !open) launcherRef.current?.focus()
    wasOpenRef.current = open
  }, [open])

  function close() { setOpen(false) }
  function start(item) {
    navigate(item.startPath, item.breakPlan ? { state: { breakPlan: item.breakPlan } } : undefined)
    close()
  }
  function openSavedPlan({ items, addedCount }) {
    setOpen(false)
    navigate('/planner', {
      state: {
        assistantPlan: {
          itemIds: items.map((item) => item.id),
          addedCount,
        },
      },
    })
  }
  async function send(event, example) {
    event?.preventDefault()
    const text = (example || message).trim()
    if (!text || busy) return
    setBusy(true); setError(''); setSchedule(null)
    const history = turns.filter((turn) => turn.role === 'user' || turn.result).slice(-10).map((turn) => ({ role: turn.role, content: turn.text }))
    const userTurn = { id: crypto.randomUUID(), role: 'user', text }
    setTurns((current) => [...current, userTurn]); setMessage('')
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 105000)
    try {
      const result = await assistantRequest('chat', {
        message: text, timezone: plannerTimeZone, history,
        existingPlan: planIntervals(getSavedPlannerBreaks()), origin: origins[origin] || null,
      }, controller.signal)
      setStatus((current) => ({ ...current, mode: result.mode, available: true }))
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: result.reply, result }])
    } catch (err) {
      setMessage(text)
      setError(errorText[err.code] || (err.name === 'AbortError' ? 'Request timed out. Your message is ready to retry.' : err.message))
      setTurns((current) => current.filter((turn) => turn.id !== userTurn.id))
    } finally { clearTimeout(timeout); setBusy(false); controllerRef.current = null }
  }
  return <div className={`assistant-widget${open ? ' is-open' : ''}`}>
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title" onKeyDown={(event) => { if (event.key === 'Escape') close() }}>
      <header className="assistant-header">
        <span className="assistant-mark"><Sprout size={22} /></span>
        <div><h2 id="assistant-title">Your break assistant</h2><p>A little room to reset.</p></div>
        <button className="assistant-icon-button" onClick={close} aria-label="Close chat"><X size={20} /></button>
      </header>
      {status?.mode === 'mock' && <p className="assistant-demo">Demo mode · no external AI calls</p>}
      <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
        {!turns.length && <div className="assistant-welcome">
          <p className="assistant-eyebrow">MAKE TIME FOR YOU</p>
          <h3>What would feel good right now?</h3>
          <p>Tell me your time and how you feel. Find an activity, or make a little space in your day.</p>
          <button onClick={(e) => send(e, 'I have 18 minutes and feel tired.')} disabled={busy}>I have 18 minutes and feel tired.</button>
          <button onClick={(e) => send(e, 'Plan breaks tomorrow from 1–2 pm and 5–6 pm.')} disabled={busy}>Plan my breaks for tomorrow.</button>
          <button onClick={(e) => send(e, 'I need a short indoor break for my shoulders.')} disabled={busy}>I need a short indoor shoulder break.</button>
        </div>}
        {turns.map((turn) => <div className={`assistant-turn ${turn.role}`} key={turn.id}>
          <p>{turn.text}</p>
          {turn.result?.processing && <div className="assistant-trace">
            <small className={`assistant-processing ${turn.result.processing}`}>{turn.result.processing === 'local' ? 'Handled locally' : 'AI-assisted'}</small>
            {turn.result.toolCall && toolLabels[turn.result.toolCall] && <small className="assistant-tool">Tool: {toolLabels[turn.result.toolCall]}</small>}
          </div>}
          {turn.result?.recommendations.map((item) => <CandidateCard key={item.token} item={item} onSchedule={setSchedule} onNavigate={start} />)}
          {turn.result?.planItems.length > 0 && <PlanPreview items={turn.result.planItems} onSaved={openSavedPlan} />}
        </div>)}
        {schedule && <PlanPreview key={schedule.token} items={[schedule]} onSaved={openSavedPlan} />}
        {busy && <p className="assistant-thinking" role="status">Finding a break that fits…</p>}
      </div>
      <div className="assistant-compose">
        {error && <p className="assistant-error" role="alert">{error}</p>}
        {showOrigin && <label className="assistant-origin">Outdoor starting point
          <select value={origin} onChange={(event) => setOrigin(event.target.value)} disabled={busy}>
            <option value="">Not selected · indoor suggestions first</option>
            <option value="townhall">Melbourne Town Hall</option><option value="docklands">Docklands</option><option value="southbank">Southbank</option>
          </select>
        </label>}
        <form onSubmit={send} className="assistant-input-row">
          <textarea ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={2}
            placeholder="How much time do you have?" aria-label="Message the break assistant"
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(event) } }} />
          <button type="submit" disabled={busy || !message.trim()} aria-label="Send message"><ArrowUp size={20} /></button>
        </form>
        <p className="assistant-privacy">{privacyText(status)} <Link to="/privacy" onClick={close}>Privacy</Link></p>
        <div className="assistant-bottom"><Link to="/planner" onClick={close}>Open Planner</Link><button disabled={busy} onClick={() => { setTurns([]); setSchedule(null); setError(''); setMessage(''); setOrigin('') }}>Clear chat</button></div>
      </div>
    </section>}
    {!open && <button ref={launcherRef} className="assistant-launcher" onClick={() => setOpen(true)} aria-expanded="false" aria-label="Open break assistant">
      <MessageCircle size={20} /><span>Ask MoveBreak</span>
    </button>}
  </div>
}
