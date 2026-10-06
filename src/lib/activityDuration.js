export function getActivitySeconds(activity) {
  const stepSeconds = (activity?.steps || []).reduce((sum, step) => sum + (step.seconds || 0), 0)
  return stepSeconds > 0 ? stepSeconds : (activity?.duration || 0) * 60
}

export function getActivityMinutes(activity) {
  return Math.max(1, Math.ceil(getActivitySeconds(activity) / 60))
}

export function formatActivityDuration(activity) {
  const seconds = getActivitySeconds(activity)
  if (seconds < 60) {
    return `${seconds} sec`
  }
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`
}
