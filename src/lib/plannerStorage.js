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
    const raw = window.localStorage.getItem(plannerStorageKey)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return fallback
    }

    const validBreaks = parsed.filter(isValidPlannerBreak)
    return validBreaks
  } catch {
    return fallback
  }
}

export function savePlannerBreaks(plannedBreaks) {
  try {
    if (!Array.isArray(plannedBreaks) || plannedBreaks.some((item) => !isValidPlannerBreak(item))) return false
    window.localStorage.setItem(plannerStorageKey, JSON.stringify(plannedBreaks))
    window.dispatchEvent(new Event('movebreak:planner-change'))
    return true
  } catch {
    // Callers can report a failed save instead of claiming success.
    return false
  }
}

// Re-read immediately before saving; Web Locks serialize cooperating tabs.
export async function addConfirmedPlannerItems(items, checkConflicts) {
  const save = () => {
    const existing = getSavedPlannerBreaks()
    checkConflicts(items, existing)
    const fresh = items.filter((item) => !existing.some((old) => old.id === item.id))
    if (!savePlannerBreaks([...existing, ...fresh])) {
      const error = new Error('Browser storage is unavailable. Your plan was not saved.')
      error.code = 'STORAGE_FAILED'
      throw error
    }
    const persistedIds = new Set(getSavedPlannerBreaks().map((item) => item.id))
    if (fresh.some((item) => !persistedIds.has(item.id))) {
      const error = new Error('The plan could not be verified after saving. Please check browser storage permissions.')
      error.code = 'STORAGE_FAILED'
      throw error
    }
    return fresh.length
  }
  return navigator.locks ? navigator.locks.request('movebreak-planner', async () => save()) : save()
}
