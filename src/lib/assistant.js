import { API_BASE_URL } from './api.js'

export const plannerTimeZone = 'Australia/Melbourne'

export async function assistantRequest(path, payload, signal) {
  const response = await fetch(`${API_BASE_URL}/ai/${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.detail?.message || 'The assistant is unavailable. Please try again.')
    error.code = data.detail?.code || (response.status === 422 ? 'INVALID_INPUT' : 'AI_UNAVAILABLE')
    throw error
  }
  return data
}

export function localDateTime(value, timeZone = plannerTimeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const p = Object.fromEntries(parts.map(({ type, value: v }) => [type, v]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export function zonedIso(value, timeZone = plannerTimeZone) {
  const wall = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(wall)) throw new Error('Choose a valid date and time.')
  let guess = wall
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(`${localDateTime(guess, timeZone)}:00Z`)
    guess += wall - rendered
  }
  if (localDateTime(guess, timeZone) !== value) throw new Error('That local time does not exist. Choose another time.')
  if ([guess - 3600000, guess + 3600000].some((other) => localDateTime(other, timeZone) === value)) {
    throw new Error('That local time is ambiguous. Choose another time.')
  }
  return new Date(guess).toISOString()
}

export function planIntervals(plan) {
  const today = localDateTime(new Date()).slice(0, 10)
  return plan.flatMap((item) => {
    try {
      const startAt = item.startAt || (/^\d{2}:\d{2}$/.test(item.time) ? zonedIso(`${item.date || today}T${item.time}`) : null)
      if (!startAt) return [] // Unscheduled "Next break" entries occupy no calendar interval.
      const endAt = item.endAt || new Date(Date.parse(startAt) + item.duration * 60000).toISOString()
      if (!Number.isFinite(Date.parse(startAt)) || Date.parse(endAt) <= Date.parse(startAt)) return []
      return [{ id: item.id, startAt, endAt }]
    } catch { return [] }
  })
}

export function checkPlanConflicts(items, existing) {
  const intervals = planIntervals(existing)
  for (const item of items) {
    if (existing.some((old) => old.id === item.id)) continue
    const start = Date.parse(item.startAt), end = Date.parse(item.endAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start <= Date.now()) {
      throw new Error('Choose a valid future time.')
    }
    if (intervals.some((old) => start < Date.parse(old.endAt) && end > Date.parse(old.startAt))) {
      const error = new Error('Your plan changed. Adjust the time to avoid a conflict.')
      error.code = 'PLAN_CONFLICT'
      throw error
    }
    intervals.push(item)
  }
}
