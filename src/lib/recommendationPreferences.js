const STORAGE_KEY = 'movebreak_recommendation_preferences_v1'

export const DEFAULT_RECOMMENDATION_PREFERENCES = {
  version: 1,
  preferredDatasetTypes: [],
  avoidedDatasetTypes: [],
  crowdPreference: 'balanced',
  preferredSetting: 'any',
  maximumWalkingMinutes: null,
  recentSelections: [],
  updatedAt: null,
}

const validCrowdPreferences = new Set(['quiet', 'balanced', 'lively'])
const validSettings = new Set(['any', 'indoor', 'outdoor'])

function uniqueStrings(values) {
  if (!Array.isArray(values)) {
    return []
  }

  return [...new Set(values.filter((value) => typeof value === 'string'))]
}

function normalisePreferences(value = {}) {
  const maximumWalkingMinutes = Number(value.maximumWalkingMinutes)

  return {
    version: 1,
    preferredDatasetTypes: uniqueStrings(value.preferredDatasetTypes),
    avoidedDatasetTypes: uniqueStrings(value.avoidedDatasetTypes),
    crowdPreference: validCrowdPreferences.has(value.crowdPreference)
      ? value.crowdPreference
      : 'balanced',
    preferredSetting: validSettings.has(value.preferredSetting)
      ? value.preferredSetting
      : 'any',
    maximumWalkingMinutes:
      Number.isFinite(maximumWalkingMinutes) && maximumWalkingMinutes > 0
        ? maximumWalkingMinutes
        : null,
    recentSelections: Array.isArray(value.recentSelections)
      ? value.recentSelections.slice(0, 20)
      : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  }
}

export function getRecommendationPreferences() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_RECOMMENDATION_PREFERENCES }
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    return rawValue
      ? normalisePreferences(JSON.parse(rawValue))
      : { ...DEFAULT_RECOMMENDATION_PREFERENCES }
  } catch {
    return { ...DEFAULT_RECOMMENDATION_PREFERENCES }
  }
}

export function saveRecommendationPreferences(updates) {
  const nextPreferences = normalisePreferences({
    ...getRecommendationPreferences(),
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences))
  } catch {
    // Recommendations still work when browser storage is unavailable.
  }

  return nextPreferences
}

export function recordRecommendationSelection(place) {
  const preferences = getRecommendationPreferences()
  const selection = {
    placeId: String(place.id),
    datasetType: place.dataset_type ?? null,
    selectedAt: new Date().toISOString(),
  }
  const recentSelections = [
    selection,
    ...preferences.recentSelections.filter(
      (item) => item.placeId !== selection.placeId,
    ),
  ].slice(0, 20)

  return saveRecommendationPreferences({ recentSelections })
}

export function resetRecommendationPreferences() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Reset failure must not break the application.
  }

  return { ...DEFAULT_RECOMMENDATION_PREFERENCES }
}

function crowdSuitability(percentile, preference) {
  if (!Number.isFinite(percentile)) {
    return 0.5
  }

  const boundedPercentile = Math.min(1, Math.max(0, percentile))
  if (preference === 'quiet') {
    return 1 - boundedPercentile
  }
  if (preference === 'lively') {
    return boundedPercentile
  }
  return Math.max(0, 1 - Math.abs(boundedPercentile - 0.5) * 2)
}

function boundedScore(value, fallback = 0.5) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

/**
 * Re-rank time-safe API results without sending browser preferences to the API.
 * Backend signals remain dominant; category preferences can move a result by
 * no more than ten percentage points.
 */
export function personaliseRecommendations(
  recommendations,
  preferences = getRecommendationPreferences(),
) {
  const preferredTypes = new Set(preferences.preferredDatasetTypes)
  const avoidedTypes = new Set(preferences.avoidedDatasetTypes)
  const recentlySelectedIds = new Set(
    preferences.recentSelections.map((item) => item.placeId),
  )

  return recommendations
    .filter((place) => {
      if (!preferences.maximumWalkingMinutes) {
        return true
      }
      return place.walking_time_one_way <= preferences.maximumWalkingMinutes
    })
    .map((place) => {
      const signals = place.ranking_signals ?? {}
      const footfallScore = crowdSuitability(
        typeof place.footfall_percentile === 'number'
          ? place.footfall_percentile
          : Number.NaN,
        preferences.crowdPreference,
      )
      const reconstructedBaseScore =
        0.40 * footfallScore
        + 0.30 * boundedScore(Number(signals.distance_score))
        + 0.15 * boundedScore(Number(signals.weather_comfort_score))
        + 0.15 * boundedScore(Number(signals.amenity_score))
      const balancedFootfallScore = boundedScore(
        Number(signals.footfall_suitability),
      )
      const apiBaseScore = Number(place.base_recommendation_score)
      const objectiveScore = Number.isFinite(apiBaseScore)
        ? apiBaseScore - 0.40 * balancedFootfallScore + 0.40 * footfallScore
        : reconstructedBaseScore

      let adjustment = 0
      if (preferredTypes.has(place.dataset_type)) {
        adjustment += 0.06
      }
      if (avoidedTypes.has(place.dataset_type)) {
        adjustment -= 0.10
      }
      // A small diversity adjustment prevents the same exact place from always
      // occupying the first position; it does not treat a click as a label.
      if (recentlySelectedIds.has(String(place.id))) {
        adjustment -= 0.02
      }

      const personalisedScore = Math.min(
        1,
        Math.max(0, objectiveScore + adjustment),
      )

      return {
        ...place,
        preference_adjustment: Number(adjustment.toFixed(4)),
        personalised_recommendation_score: Number(personalisedScore.toFixed(4)),
      }
    })
    .sort((first, second) => {
      const scoreDifference =
        second.personalised_recommendation_score
        - first.personalised_recommendation_score

      if (scoreDifference !== 0) {
        return scoreDifference
      }
      return (first.walking_distance_m ?? Infinity) - (second.walking_distance_m ?? Infinity)
    })
}
