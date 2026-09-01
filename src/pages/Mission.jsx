import { useState } from 'react'
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

const durationOptions = [5, 10, 15]

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

const apiNeedByLabel = {
  'Eyes tired': 'Eyes',
  'Stiff shoulders': 'Shoulders',
  'Low energy': 'Low energy',
  'Feeling stressed': 'Breathing',
  'General movement': 'Movement',
}

function getInitialDuration(searchParams) {
  // URL search params are strings, so convert duration before comparing with numeric options.
  const duration = Number(searchParams.get('duration'))

  // Fall back to 10 minutes if the URL is missing duration or contains an unsupported value.
  return durationOptions.includes(duration) ? duration : 10
}

function Mission() {
  const [searchParams] = useSearchParams()
  const [duration, setDuration] = useState(() => getInitialDuration(searchParams))
  const [movementType, setMovementType] = useState('Outdoor')
  const [need, setNeed] = useState('Low energy')
  const [mission, setMission] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const selectedPlace = mission?.place ?? mapPlaces[0]
  const previewTitle = mission?.title ?? 'Flagstaff Fresh-Air Loop'
  const previewDescription =
    mission?.description ?? 'Choose your options, then generate a break that fits.'
  const previewDuration = mission?.duration ?? duration
  const previewSteps =
    mission?.steps ?? [
      { label: 'Walk out', duration: 4 },
      { label: 'Reset', duration: 2 },
      { label: 'Walk back', duration: 4 },
    ]

  async function loadMission(nextMovementType = movementType) {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/missions/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duration,
          setting: nextMovementType,
          need: apiNeedByLabel[need] ?? need,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to load mission')
      }

      const data = await response.json()
      setMission(data)
    } catch {
      setError('Mission options are unavailable right now.')
    } finally {
      setIsLoading(false)
    }
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
                    onClick={() => setMovementType(option.label)}
                    type="button"
                  >
                    <img src={option.image} alt={option.imageAlt} />
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>

              <Button className="surprise-button" size="sm" variant="outline" type="button">
                <Shuffle size={15} />
                Surprise me
              </Button>
            </div>

            <div className="builder-section">
              <div className="builder-question">
                <span>3</span>
                <h2>What do you need?</h2>
              </div>

              <div className="need-chip-row">
                {needOptions.map((option) => {
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

              <Button className="show-options-button" onClick={() => loadMission()} type="button">
                <Footprints size={17} />
                {isLoading ? 'Finding options' : 'Show my options'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="mission-preview-card">
          <div className="title-with-icon">
            <MapPin size={18} />
            <h2>Your mission preview</h2>
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

            <div className="route-breakdown">
              {previewSteps.map((step) => (
                <span key={step.label}>
                  {step.label === 'Reset' ? <Leaf size={16} /> : <Footprints size={16} />}
                  <strong>{step.label}</strong>
                  {step.duration} min
                </span>
              ))}
            </div>

            {error ? <p className="mission-status-message">{error}</p> : null}

            <Button asChild className="preview-primary-button">
              <Link to="/explore">
                <Map size={17} />
                Open in Explore Map
              </Link>
            </Button>
            <Button
              className="preview-secondary-button"
              onClick={() => {
                const nextMovementType = movementType === 'Indoor' ? 'Outdoor' : 'Indoor'
                setMovementType(nextMovementType)
                loadMission(nextMovementType)
              }}
              variant="outline"
              type="button"
            >
              <Armchair size={17} />
              Try {movementType === 'Indoor' ? 'outdoor' : 'indoor'} instead
            </Button>

            <p className="return-note">
              <TimerReset size={15} />
              Includes time to return.
            </p>
          </div>
        </Card>
      </div>
    </section>
  )
}

export default Mission
