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
  PLAN_CONFLICT: '计划发生冲突，请调整时间后重试。', OUTSIDE_WINDOW: '整个活动必须安排在原来的空闲窗口内。',
  PAST_TIME: '请选择未来的开始时间。', PREVIEW_EXPIRED: '此预览已过期，请重新生成。',
  AI_RATE_LIMIT: '请求较多，请稍后再试。', AI_TIMEOUT: '回复超时，请重试或使用活动库。',
  AI_UNAVAILABLE: '助手暂时不可用，请稍后重试。', STORAGE_FAILED: '浏览器无法保存计划，请检查存储设置。',
  DURATION_CHANGED: '活动时长已更新，请重新生成预览。', AI_DISABLED: '助手尚未启用，你仍可浏览活动库。',
}

function CandidateCard({ item, zh, onSchedule, onNavigate }) {
  return <article className="assistant-candidate">
    <div className="assistant-candidate-meta"><span>{item.setting === 'Indoor' ? (zh ? '室内' : 'Indoor') : (zh ? '户外 · 估算' : 'Outdoor · estimated')}</span><strong>{item.durationMinutes} {zh ? '分钟' : 'min'}</strong></div>
    <h3>{item.title}</h3>
    <p>{item.reason}</p>
    <div className="assistant-card-actions">
      <button type="button" onClick={() => onNavigate(item)}>{zh ? '开始活动' : 'Start break'}</button>
      <button type="button" onClick={() => onSchedule(item)}><CalendarPlus size={14} />{zh ? '安排时间' : 'Schedule'}</button>
    </div>
  </article>
}

function previewEnd(time, duration) {
  try { return localDateTime(Date.parse(zonedIso(time)) + duration * 60000).replace('T', ' ') }
  catch { return '' }
}

function PlanPreview({ items, zh, onSaved }) {
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
      await addConfirmedPlannerItems(result.items, checkPlanConflicts)
      setSaved(true)
      onSaved?.()
    } catch (err) {
      setError(zh ? (errorText[err.code] || '未能加入计划，请检查时间或重新生成。') : err.message)
    } finally { setBusy(false) }
  }
  return <form className="assistant-plan" onSubmit={confirm}>
    <p className="assistant-plan-label">{zh ? '计划预览 · 墨尔本时间' : 'Plan preview · Melbourne time'}</p>
    {items.map((item, i) => <div className="assistant-plan-item" key={item.token}>
      <strong>{item.title}</strong><span>{item.durationMinutes} {zh ? '分钟' : 'min'}</span>
      {item.windowStart && <small>{localDateTime(item.windowStart).replace('T', ' ')} – {localDateTime(item.windowEnd).slice(11)}</small>}
      <label>{zh ? '开始时间' : 'Start time'}
        <input type="datetime-local" required value={times[i]} disabled={busy || saved}
          onChange={(event) => setTimes(times.map((time, index) => index === i ? event.target.value : time))} />
      </label>
      {times[i] && <small>{zh ? '结束时间' : 'End time'}: {previewEnd(times[i], item.durationMinutes)}</small>}
    </div>)}
    {error && <p className="assistant-error" role="alert">{error}</p>}
    <button className="assistant-primary" disabled={busy || saved} type="submit">
      {saved ? <Check size={16} /> : <CalendarPlus size={16} />}
      {saved ? (zh ? '已加入 Planner' : 'Added to Planner') : busy ? (zh ? '正在检查…' : 'Checking…') : (zh ? '确认加入 Planner' : 'Confirm & add to Planner')}
    </button>
    {saved && <Link to="/planner">{zh ? '查看计划' : 'View your plan'}</Link>}
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
  const [zh, setZh] = useState(false)
  const inputRef = useRef(null)
  const logRef = useRef(null)
  const launcherRef = useRef(null)
  const controllerRef = useRef(null)
  const navigate = useNavigate()

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

  function close() { setOpen(false); launcherRef.current?.focus() }
  function start(item) {
    navigate(item.startPath, item.breakPlan ? { state: { breakPlan: item.breakPlan } } : undefined)
    close()
  }
  async function send(event, example) {
    event?.preventDefault()
    const text = (example || message).trim()
    if (!text || busy) return
    const nextZh = /[\u4e00-\u9fff]/.test(text)
    setZh(nextZh); setBusy(true); setError(''); setSchedule(null)
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
      setZh(result.language.startsWith('zh'))
      setStatus((current) => ({ ...current, mode: result.mode, available: true }))
      setTurns((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: result.reply, result }])
    } catch (err) {
      setMessage(text)
      setError(nextZh ? (errorText[err.code] || '请求失败，输入已保留，请重试。') : err.name === 'AbortError' ? 'Request timed out. Your message is ready to retry.' : err.message)
      setTurns((current) => current.filter((turn) => turn.id !== userTurn.id))
    } finally { clearTimeout(timeout); setBusy(false); controllerRef.current = null }
  }
  return <div className="assistant-widget">
    {open && <section className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title" onKeyDown={(event) => { if (event.key === 'Escape') close() }}>
      <header className="assistant-header">
        <span className="assistant-mark"><Sprout size={22} /></span>
        <div><h2 id="assistant-title">{zh ? '休息助手' : 'Your break assistant'}</h2><p>{zh ? '找到适合此刻的短休息' : 'A little room to reset.'}</p></div>
        <button className="assistant-icon-button" onClick={close} aria-label={zh ? '关闭聊天' : 'Close chat'}><X size={20} /></button>
      </header>
      {status?.mode === 'mock' && <p className="assistant-demo">{zh ? '演示模式 · 无外部 AI 调用，仅支持中英文示例' : 'Demo mode · no external AI calls · English / 中文'}</p>}
      <div className="assistant-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
        {!turns.length && <div className="assistant-welcome">
          <p className="assistant-eyebrow">MAKE TIME FOR YOU</p>
          <h3>{zh ? '你现在需要怎样的休息？' : 'What would feel good right now?'}</h3>
          <p>{zh ? '告诉我时间和偏好。我会推荐现有活动，或帮你安排休息。' : 'Tell me your time and how you feel. Find an activity, or make a little space in your day.'}</p>
          <button onClick={(e) => send(e, 'I have 18 minutes and feel tired.')} disabled={busy}>I have 18 minutes and feel tired.</button>
          <button onClick={(e) => send(e, 'Plan breaks tomorrow from 1–2 pm and 5–6 pm.')} disabled={busy}>Plan my breaks for tomorrow.</button>
          <button onClick={(e) => send(e, '我只有18分钟，今天很累。')} disabled={busy}>我只有18分钟，今天很累。</button>
        </div>}
        {turns.map((turn) => <div className={`assistant-turn ${turn.role}`} key={turn.id}>
          <p>{turn.text}</p>
          {turn.result?.recommendations.map((item) => <CandidateCard key={item.token} item={item} zh={turn.result.language.startsWith('zh')} onSchedule={setSchedule} onNavigate={start} />)}
          {turn.result?.planItems.length > 0 && <PlanPreview items={turn.result.planItems} zh={turn.result.language.startsWith('zh')} />}
        </div>)}
        {schedule && <PlanPreview key={schedule.token} items={[schedule]} zh={zh} />}
        {busy && <p className="assistant-thinking" role="status">{zh ? '正在为你寻找合适的休息…' : 'Finding a break that fits…'}</p>}
      </div>
      <div className="assistant-compose">
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <label className="assistant-origin">{zh ? '户外出发地点' : 'Outdoor starting point'}
          <select value={origin} onChange={(event) => setOrigin(event.target.value)} disabled={busy}>
            <option value="">{zh ? '未选择 · 先推荐室内活动' : 'Not selected · indoor suggestions first'}</option>
            <option value="townhall">Melbourne Town Hall</option><option value="docklands">Docklands</option><option value="southbank">Southbank</option>
          </select>
        </label>
        <form onSubmit={send} className="assistant-input-row">
          <textarea ref={inputRef} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={2}
            placeholder={zh ? '告诉我你的时间和偏好…' : 'How much time do you have?'} aria-label={zh ? '发送给休息助手的消息' : 'Message the break assistant'}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(event) } }} />
          <button type="submit" disabled={busy || !message.trim()} aria-label={zh ? '发送消息' : 'Send message'}><ArrowUp size={20} /></button>
        </form>
        <p className="assistant-privacy">{status?.mode === 'mock' ? (zh ? '消息仅在本地演示后端处理。' : 'Messages stay with your local demo backend.') : (zh ? '消息和最近对话将发送给 NVIDIA 处理。' : 'Messages and recent conversation are processed by NVIDIA when AI is enabled.')} <Link to="/privacy" onClick={close}>{zh ? '隐私' : 'Privacy'}</Link></p>
        <div className="assistant-bottom"><Link to="/planner" onClick={close}>{zh ? '打开 Planner' : 'Open Planner'}</Link><button disabled={busy} onClick={() => { setTurns([]); setSchedule(null); setError(''); setMessage('') }}>{zh ? '清除对话' : 'Clear chat'}</button></div>
      </div>
    </section>}
    <button ref={launcherRef} className="assistant-launcher" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-label={open ? 'Close break assistant' : 'Open break assistant'}>
      {open ? <X size={20} /> : <MessageCircle size={20} />}<span>{zh ? '休息助手' : 'Ask MoveBreak'}</span>
    </button>
  </div>
}
