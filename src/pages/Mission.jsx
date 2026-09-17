import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import {
  Armchair,
  BatteryCharging,
  Clock3,
  Eye,
  Footprints,
  Leaf,
  Map,
  MapPin,
  Shuffle,
  TimerReset,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mapPlaces, melbourneCenter } from '@/data/mapPlaces'
import { API_BASE_URL } from '@/lib/api'
import { createMarkerIcon } from '@/lib/mapMarkers'
import greenSpaceImage from '@/assets/home/green-space-reset.jpg'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

const durationOptions = [5, 15, 30]

const movementOptions = [
  {
    label: 'Indoor',
    description: 'Guided activities you can do at your desk',
    image: shoulderReleaseImage,
    imageAlt: 'Person stretching beside a desk',
  },
  {
    label: 'Outdoor',
    description: 'Nearby walks and outdoor resets',
    image: greenSpaceImage,
    imageAlt: 'Tree-lined walking path beside Melbourne city',
  },
]

const needOptions = [
  { icon: Eye, label: 'Eyes tired' },
  { icon: Armchair, label: 'Stiff shoulders' },
  { icon: Zap, label: 'Low energy' },
  { icon: Leaf, label: 'Feeling stressed' },
  { icon: Footprints, label: 'General movement' },
]

const outdoorNeedOptions = [
  { icon: Leaf, label: 'Fresh air' },
  { icon: MapPin, label: 'Quiet space' },
  { icon: Footprints, label: 'Short walk' },
  { icon: Map, label: 'Green space' },
  { icon: Zap, label: 'Low effort' },
]

const apiNeedByLabel = {
  'Eyes tired': 'Eyes',
  'Stiff shoulders': 'Shoulders',
  'Low energy': 'Low energy',
  'Feeling stressed': 'Breathing',
  'General movement': 'Movement',
  'Fresh air': 'Fresh air',
  'Quiet space': 'Quiet space',
  'Short walk': 'Short walk',
  'Green space': 'Green space',
  'Low effort': 'Low effort',
}

const locationStatusMessages = {
  idle: '',
  loading: 'Finding your current location for nearby outdoor options...',
  ready: 'Current location ready. Outdoor options will use your location.',
  unsupported: 'Location prompts need a supported browser on localhost, 127.0.0.1 or HTTPS.',
  denied: 'Location access is blocked. Allow location in the browser site settings, then try again.',
  timeout: 'Location took too long to respond. Try again from the button below.',
  unavailable: 'Could not get your location. Check browser permissions and try again.',
}

function getLocationErrorStatus(locationError) {
  if (locationError.code === 1 || locationError.code === locationError.PERMISSION_DENIED) {
    return 'denied'
  }

  if (locationError.code === 3 || locationError.code === locationError.TIMEOUT) {
    return 'timeout'
  }

  return 'unavailable'
}

function getInitialDuration(searchParams) {
  // URL search params are strings, so convert duration before comparing with numeric options.
  const duration = Number(searchParams.get('duration'))

  // Fall back to 15 minutes if the URL is missing duration or contains an unsupported value.
  return durationOptions.includes(duration) ? duration : 15
}

function getFlowTarget(movementType, duration, sessionActivities, userLocation, need, placeId) {
  if (movementType === 'Indoor') {
    const ids = sessionActivities.map((activity) => activity.id).join(',')
    return ids ? `/guided/indoor-session?ids=${ids}` : `/activities?duration=${duration}`
  }

  const params = new URLSearchParams({ duration: String(duration), need })

  if (userLocation) {
    params.set('lat', String(userLocation.latitude))
    params.set('lng', String(userLocation.longitude))
  }

  if (placeId) {
    params.set('place', String(placeId))
  }

  return `/explore?${params.toString()}`
}

function formatSessionTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (!minutes) {
    return `${seconds}s`
  }

  return seconds ? `${minutes}m ${seconds}s` : `${minutes} min`
}

function getSurpriseMovementType(currentMovementType) {
  const otherMovementType = currentMovementType === 'Indoor' ? 'Outdoor' : 'Indoor'

  return Math.random() > 0.5 ? currentMovementType : otherMovementType
}

function getRandomOption(options) {
  return options[Math.floor(Math.random() * options.length)]
}

function Mission() {
  const [searchParams] = useSearchParams()
  const [duration, setDuration] = useState(() => getInitialDuration(searchParams))
  const [movementType, setMovementType] = useState('Indoor')
  const [need, setNeed] = useState('Low energy')
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const locationRequestRef = useRef(null)
  const [mission, setMission] = useState(null)
  const [sessionActivities, setSessionActivities] = useState([])
  const [sessionTotalSeconds, setSessionTotalSeconds] = useState(0)
  const [isSurpriseRecommendation, setIsSurpriseRecommendation] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const selectedPlace = mission?.place ?? mapPlaces[0]
  const isIndoor = movementType === 'Indoor'
  const previewTitle = isIndoor
    ? sessionActivities.length
      ? `${sessionActivities.length} exercise${sessionActivities.length === 1 ? '' : 's'} for you`
      : 'Your indoor session'
    : (mission?.title ?? 'Flagstaff Fresh-Air Loop')
  const previewDescription = isIndoor
    ? 'A guided session that runs through each exercise one by one.'
    : (mission?.description ?? 'Choose your options, then generate a break that fits.')
  const previewDuration = isIndoor
    ? Math.round(sessionTotalSeconds / 60) || duration
    : (mission?.duration ?? duration)
  const previewSteps =
    mission?.steps ?? [
      { label: 'Walk there', duration: 4 },
      { label: 'Rest', duration: 4 },
      { label: 'Walk back', duration: 4 },
      { label: 'Buffer', duration: 1 },
    ]
  const flowTarget = getFlowTarget(
    movementType,
    duration,
    sessionActivities,
    userLocation,
    need,
    mission?.place?.id,
  )
  const primaryActionLabel = isIndoor
    ? 'Start session'
    : isSurpriseRecommendation
      ? 'Start recommendation'
      : 'Open map'
  const PrimaryActionIcon = isIndoor ? Armchair : Map
  const currentNeedOptions = movementType === 'Indoor' ? needOptions : outdoorNeedOptions
  const needQuestion =
    movementType === 'Indoor'
      ? 'What do you need?'
      : 'What kind of outdoor reset do you want?'
  const isFindingOutdoorLocation = !isIndoor && locationStatus === 'loading'
  const canRequestOutdoorLocation =
    !isIndoor && !isFindingOutdoorLocation && locationStatus !== 'ready'

  useEffect(() => {
    function closePreviewOnEscape(event) {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false)
      }
    }

    window.addEventListener('keydown', closePreviewOnEscape)
    return () => window.removeEventListener('keydown', closePreviewOnEscape)
  }, [])

  const requestOutdoorLocation = useCallback(() => {
    if (locationRequestRef.current) {
      return locationRequestRef.current
    }

    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return Promise.resolve({ location: null, status: 'unsupported' })
    }

    setLocationStatus('loading')

    locationRequestRef.current = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const nextLocation = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          }

          setUserLocation(nextLocation)
          setLocationStatus('ready')
          locationRequestRef.current = null
          resolve({ location: nextLocation, status: 'ready' })
        },
        (locationError) => {
          const nextStatus = getLocationErrorStatus(locationError)

          setUserLocation(null)
          setLocationStatus(nextStatus)
          locationRequestRef.current = null
          resolve({ location: null, status: nextStatus })
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        },
      )
    })

    return locationRequestRef.current
  }, [])

  function handleMovementTypeChange(nextMovementType) {
    setMovementType(nextMovementType)
    setMission(null)
    setSessionActivities([])
    setSessionTotalSeconds(0)
    setError('')

    // Keep Step 3 meaningful by switching to a default need that matches the selected setting.
    if (nextMovementType === 'Indoor' && !needOptions.some((option) => option.label === need)) {
      setNeed('Low energy')
    }

    if (nextMovementType === 'Outdoor' && !outdoorNeedOptions.some((option) => option.label === need)) {
      setNeed('Fresh air')
    }

    if (nextMovementType === 'Outdoor' && !userLocation) {
      requestOutdoorLocation()
    }
  }

  async function loadMission(nextMovementType = movementType, nextNeed = need, nextLocation = userLocation) {
    setIsLoading(true)
    setError('')

    const isNextIndoor = nextMovementType === 'Indoor'
    const endpoint = isNextIndoor ? 'missions/recommend-session' : 'missions/recommend'
    const locationPayload =
      !isNextIndoor && nextLocation
        ? {
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
          }
        : {}

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duration,
          setting: nextMovementType,
          need: apiNeedByLabel[nextNeed] ?? nextNeed,
          ...locationPayload,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to load mission')
      }

      const data = await response.json()

      if (isNextIndoor) {
        setSessionActivities(data.activities ?? [])
        setSessionTotalSeconds(data.totalSeconds ?? 0)
      } else {
        setMission(data)
      }
    } catch {
      setError('Mission options are unavailable right now.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleShowOptions() {
    setIsSurpriseRecommendation(false)
    loadSelectedMission(movementType, need, false)
  }

  function handleSurpriseMe() {
    const nextMovementType = getSurpriseMovementType(movementType)
    const nextNeedOptions = nextMovementType === 'Indoor' ? needOptions : outdoorNeedOptions
    const nextNeed = getRandomOption(nextNeedOptions).label

    setIsSurpriseRecommendation(true)
    handleMovementTypeChange(nextMovementType)
    setNeed(nextNeed)
    loadSelectedMission(nextMovementType, nextNeed, true)
  }

  async function loadSelectedMission(nextMovementType, nextNeed, isSurprise) {
    setIsSurpriseRecommendation(isSurprise)
    setError('')

    let nextLocation = userLocation
    let nextLocationStatus = locationStatus
    if (nextMovementType === 'Outdoor' && !nextLocation) {
      const locationResult = await requestOutdoorLocation()
      nextLocation = locationResult.location
      nextLocationStatus = locationResult.status
    }

    if (nextMovementType === 'Outdoor' && !nextLocation) {
      setError(locationStatusMessages[nextLocationStatus] || locationStatusMessages.unavailable)
      return
    }

    setIsPreviewOpen(true)
    loadMission(nextMovementType, nextNeed, nextLocation)
  }

  return (
    <section className="page mission-page">
      <div className="mission-shell">
        <div className="mission-builder">
          <div className="mission-heading">
            <h1>Find the right break</h1>
            <p>Choose what fits your time, space and energy right now.</p>
          </div>

          <Card className="mission-builder-card">
            <div className="builder-section">
              <div className="builder-question">
                <span>1</span>
                <h2>How much time do you have?</h2>
              </div>
              <div className="mission-duration-tabs" aria-label="Choose break duration">
                {durationOptions.map((option) => (
                  <button
                    className={option === duration ? 'selected' : ''}
                    key={option}
                    onClick={() => setDuration(option)}
                    type="button"
                  >
                    {option} min
                  </button>
                ))}
              </div>
            </div>

            <div className="builder-section">
              <div className="builder-question">
                <span>2</span>
                <h2>Where would you like to move?</h2>
              </div>

              <div className="movement-choice-grid">
                {movementOptions.map((option) => (
                  <button
                    className={option.label === movementType ? 'movement-card selected' : 'movement-card'}
                    key={option.label}
                    onClick={() => handleMovementTypeChange(option.label)}
                    type="button"
                  >
                    <img src={option.image} alt={option.imageAlt} />
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>

              {!isIndoor && locationStatusMessages[locationStatus] ? (
                <p className={`mission-location-status ${locationStatus}`}>
                  <MapPin size={15} />
                  {locationStatusMessages[locationStatus]}
                </p>
              ) : null}
              {canRequestOutdoorLocation ? (
                <button
                  className="mission-location-retry"
                  onClick={requestOutdoorLocation}
                  type="button"
                >
                  <MapPin size={15} />
                  {locationStatus === 'idle' ? 'Use my location' : 'Try location again'}
                </button>
              ) : null}

            </div>

            <div className="builder-section">
              <div className="builder-question">
                <span>3</span>
                <h2>{needQuestion}</h2>
              </div>

              <div className="need-chip-row">
                {currentNeedOptions.map((option) => {
                  const Icon = option.icon

                  return (
                    <button
                      className={option.label === need ? 'selected' : ''}
                      key={option.label}
                      onClick={() => setNeed(option.label)}
                      type="button"
                    >
                      <Icon size={15} />
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <div className="mission-action-row">
                <Button
                  disabled={isLoading || isFindingOutdoorLocation}
                  onClick={handleSurpriseMe}
                  type="button"
                  variant="outline"
                >
                  <Shuffle size={17} />
                  {isLoading && isSurpriseRecommendation ? 'Picking for you' : 'Pick for me'}
                </Button>
                <Button disabled={isLoading || isFindingOutdoorLocation} onClick={handleShowOptions} type="button">
                  <Footprints size={17} />
                  {isFindingOutdoorLocation
                    ? 'Finding location'
                    : isLoading && !isSurpriseRecommendation
                      ? 'Finding options'
                      : 'Show my options'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {isPreviewOpen ? (
          <div
            aria-labelledby="mission-preview-title"
            className="mission-preview-modal"
            onMouseDown={() => setIsPreviewOpen(false)}
            role="dialog"
            aria-modal="true"
          >
          <Card className="mission-preview-card" onMouseDown={(event) => event.stopPropagation()}>
            <button
              aria-label="Close mission preview"
              className="mission-preview-close"
              onClick={() => setIsPreviewOpen(false)}
              type="button"
            >
              <X size={19} aria-hidden="true" />
            </button>
          <div className="title-with-icon">
            <MapPin size={18} />
            <h2 id="mission-preview-title">Your mission preview</h2>
          </div>

          <div className="preview-panel">
            <h3>{previewTitle}</h3>
            <p className="mission-preview-description">{previewDescription}</p>
            <div className="preview-tags">
              <Badge variant="success">{movementType}</Badge>
              <Badge variant="secondary">
                <Clock3 size={13} />
                {previewDuration} min
              </Badge>
              <Badge variant="secondary">
                <BatteryCharging size={13} />
                {need}
              </Badge>
            </div>

            {isIndoor ? (
              <ol className="indoor-session-preview-list">
                {sessionActivities.map((activity, index) => (
                  <li key={activity.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{activity.title}</strong>
                      <small>
                        {formatSessionTime(
                          activity.steps.reduce((sum, step) => sum + step.seconds, 0),
                        )}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="preview-map">
                <MapContainer
                  center={melbourneCenter}
                  className="mission-preview-leaflet-map"
                  dragging={false}
                  scrollWheelZoom={false}
                  zoom={14}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker
                    icon={createMarkerIcon(selectedPlace.marker, selectedPlace.markerTone)}
                    position={selectedPlace.position}
                  >
                    <Popup>
                      <strong>{selectedPlace.name}</strong>
                      <br />
                      {selectedPlace.distance}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}

            {isIndoor ? null : (
              <div className="route-breakdown">
                {previewSteps.map((step) => (
                  <span key={step.label}>
                    {step.label === 'Rest' ? (
                      <Leaf size={16} />
                    ) : step.label === 'Buffer' ? (
                      <TimerReset size={16} />
                    ) : (
                      <Footprints size={16} />
                    )}
                    <strong>{step.label}</strong>
                    {Math.round(step.duration)} min
                  </span>
                ))}
              </div>
            )}

            {error ? <p className="mission-status-message">{error}</p> : null}

            {isIndoor && (isLoading || !sessionActivities.length) ? (
              <Button className="mt-[0.72rem] w-full" disabled type="button">
                <PrimaryActionIcon size={17} />
                {isLoading ? 'Finding exercises' : primaryActionLabel}
              </Button>
            ) : (
              <Button asChild className="mt-[0.72rem] w-full">
                <Link to={flowTarget}>
                  <PrimaryActionIcon size={17} />
                  {primaryActionLabel}
                </Link>
              </Button>
            )}

            {isIndoor ? null : (
              <p className="return-note">
                <TimerReset size={15} />
                Includes time to return.
              </p>
            )}
          </div>
        </Card>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default Mission
