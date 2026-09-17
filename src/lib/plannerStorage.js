export const plannerStorageKey = 'movebreak-planned-breaks'

const allowedTypes = new Set(['Indoor', 'Outdoor'])
const allowedPeriods = new Set(['Morning', 'Afternoon'])
const allowedStatuses = new Set(['Start', 'Completed', 'View route'])
const allowedIconKeys = new Set(['CalendarDays', 'Eye', 'Footprints'])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isOptionalString(value) {
  return value === undefined || typeof value === 'string'
}

export function isValidPlannerBreak(entry) {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    isNonEmptyString(entry.id) &&
    isNonEmptyString(entry.activity) &&
    allowedTypes.has(entry.type) &&
    allowedPeriods.has(entry.period) &&
    isPositiveFiniteNumber(entry.duration) &&
    isOptionalString(entry.time) &&
    isOptionalString(entry.status) &&
    (entry.status === undefined || allowedStatuses.has(entry.status)) &&
    isOptionalString(entry.iconKey) &&
    (entry.iconKey === undefined || allowedIconKeys.has(entry.iconKey)) &&
    isOptionalString(entry.placeId) &&
    isOptionalString(entry.address) &&
    isOptionalString(entry.directionsUrl)
  )
}

export function getSavedPlannerBreaks(fallback = []) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(plannerStorageKey) ?? '[]')

    if (!Array.isArray(parsed)) {
      return fallback
    }

    const validBreaks = parsed.filter(isValidPlannerBreak)
    return validBreaks.length ? validBreaks : fallback
  } catch {
    return fallback
  }
}

export function savePlannerBreaks(plannedBreaks) {
  try {
    const validBreaks = plannedBreaks.filter(isValidPlannerBreak)
    window.localStorage.setItem(plannerStorageKey, JSON.stringify(validBreaks))
  } catch {
    // Planner storage is a convenience cache; never let it break the page.
  }
}
