import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Crosshair,
  Footprints,
  Landmark,
  Leaf,
  MapPin,
  Navigation,
  Play,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { melbourneCenter } from '@/data/mapPlaces'
import { API_BASE_URL } from '@/lib/api'
import { createCurrentLocationIcon, createMarkerIcon } from '@/lib/mapMarkers'

const defaultMapZoom = 14
const currentLocationZoom = 16
const defaultOutdoorBreakDuration = 15
const maxVisiblePlaces = 40
const durationOptions = [5, 15, 30]
const plannerStorageKey = 'movebreak-planned-breaks'
const testOriginOptions = [
  { label: 'Docklands', position: [-37.8183, 144.9467] },
  { label: 'Southbank', position: [-37.8215, 144.9646] },
  { label: 'Carlton', position: [-37.8001, 144.9671] },
  { label: 'Fitzroy', position: [-37.7984, 144.9783] },
  { label: 'South Yarra', position: [-37.8384, 144.9910] },
]

const placeIcons = {
  'Green space': Leaf,
  'Waterfront green space': Leaf,
  'Quiet public space': Building2,
  'Open public square': Landmark,
  'Outdoor Space': Leaf,
  Seat: Landmark,
  Amenity: Building2,
  'Food and Drink': Building2,
  'Food Shopping': Building2,
}

function getPlaceCategory(place) {
  // Prefer the future DS-provided category, but keep type as a fallback for the current dataset.
  return place.category ?? place.type
}

function getInitialDuration(searchParams) {
  const duration = Number(searchParams.get('duration'))

  return durationOptions.includes(duration) ? duration : defaultOutdoorBreakDuration
}

function getPlaceFitLabel(place, duration) {
  return place.is_time_safe ? `Fits your ${duration} min break` : 'Outside current time range'
}

function getPlaceSpareLabel(place) {
  return place.remaining_time !== undefined ? `${Math.round(place.remaining_time)} min spare` : 'Spare time unavailable'
}

function getWalkTimeLabel(place) {
  return place.walking_time_one_way_label ?? `${place.walking_time_one_way} min`
}

function getPlaceDirectionsUrl(place, origin) {
  const destination = place.position ?? [place.latitude, place.longitude]

  if (!destination?.[0] || !destination?.[1]) {
    const query = encodeURIComponent(`${place.name} ${place.address ?? ''}`.trim())
    return `https://www.google.com/maps/search/?api=1&query=${query}`
  }

  const params = new URLSearchParams({
    api: '1',
    destination: `${destination[0]},${destination[1]}`,
    travelmode: 'walking',
  })

  if (origin) {
    params.set('origin', `${origin[0]},${origin[1]}`)
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function getSavedPlannerBreaks() {
  try {
    const savedBreaks = JSON.parse(localStorage.getItem(plannerStorageKey) ?? '[]')

    return Array.isArray(savedBreaks) ? savedBreaks : []
  } catch {
    return []
  }
}

function getOutdoorBreakPlan(place, duration, origin) {
  return {
    placeId: place.id,
    placeName: place.name,
    category: getPlaceCategory(place),
    address: place.address,
    availableTime: duration,
    walkThereMinutes: place.walking_time_one_way,
    restMinutes: place.activity_time,
    walkBackMinutes: place.walking_time_one_way,
    bufferMinutes: place.buffer_time,
    estimatedTotalMinutes: place.estimated_total_time,
    remainingMinutes: place.remaining_time,
    directionsUrl: getPlaceDirectionsUrl(place, origin),
  }
}

function CurrentLocationView({ position }) {
  const map = useMap()

  useEffect(() => {
    if (!position) {
      return
    }

    // Move the map to the browser-provided location once Aisha grants permission.
    map.flyTo(position, currentLocationZoom, {
      animate: true,
      duration: 0.7,
    })
  }, [map, position])

  return null
}

function ExploreMap() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDuration = getInitialDuration(searchParams)
  const [places, setPlaces] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPosition, setCurrentPosition] = useState(null)
  const [originLabel, setOriginLabel] = useState('Melbourne CBD')
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [plannedPlaceIds, setPlannedPlaceIds] = useState(
    () => new Set(getSavedPlannerBreaks().map((plannedBreak) => plannedBreak.placeId).filter(Boolean)),
  )
  const selectedPlaceSuitability = selectedPlace ? getPlaceFitLabel(selectedPlace, selectedDuration) : null
  const categoryOptions = useMemo(
    // Build category buttons from place data so new DS categories appear without frontend changes.
    () => ['All', ...new Set(places.map((place) => getPlaceCategory(place)).filter(Boolean))],
    [places],
  )
  const filteredPlaces = useMemo(
    () =>
      places.filter((place) => {
        const category = getPlaceCategory(place)

        return selectedCategory === 'All' || category === selectedCategory
      }),
    [places, selectedCategory],
  )
  const visiblePlaces = useMemo(
    () =>
      filteredPlaces.slice(0, maxVisiblePlaces).map((place, index) => ({
        ...place,
        displayMarker: String(index + 1),
      })),
    [filteredPlaces],
  )

  useEffect(() => {
    async function loadRecommendations() {
      setIsLoading(true)
      setError('')

      try {
        const origin = currentPosition ?? melbourneCenter
        const query = new URLSearchParams({
          lat: String(origin[0]),
          lng: String(origin[1]),
          break_time: String(selectedDuration),
          limit: '5',
        })
        const response = await fetch(`${API_BASE_URL}/recommendations?${query.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to load recommendations')
        }

        const data = await response.json()
        setPlaces(data.recommendations ?? [])
        setSelectedPlace(null)
        // No place is selected by default — the detail card only opens
        // once the user actively picks one from the map or the list.
      } catch {
        setError('Time-safe recommendations are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [currentPosition, selectedDuration])

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Current location is not supported in this browser.')
      return
    }

    setIsLocating(true)
    setLocationStatus('Finding your current location...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition = [position.coords.latitude, position.coords.longitude]

        setCurrentPosition(nextPosition)
        setOriginLabel('Current location')
        setLocationStatus('')
        setIsLocating(false)
      },
      () => {
        setLocationStatus('Location access was denied or unavailable. Melbourne CBD remains selected.')
        setIsLocating(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    )
  }

  function handleDurationChange(duration) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('duration', String(duration))
    setSearchParams(nextSearchParams)
    setSelectedPlace(null)
  }

  function handleTestOriginChange(testOrigin) {
    setCurrentPosition(testOrigin.position)
    setOriginLabel(testOrigin.label)
    setLocationStatus(`Recommendations from ${testOrigin.label}.`)
    setSelectedPlace(null)
  }

  function handleRandomTestOrigin() {
    const nextOrigin = testOriginOptions[Math.floor(Math.random() * testOriginOptions.length)]
    handleTestOriginChange(nextOrigin)
  }

  function handleAddSelectedPlaceToPlanner() {
    if (!selectedPlace) {
      return
    }

    const savedBreak = {
      id: `outdoor-${selectedPlace.id}`,
      placeId: selectedPlace.id,
      time: 'Next break',
      activity: selectedPlace.name,
      duration: selectedDuration,
      type: 'Outdoor',
      period: 'Afternoon',
      status: 'View route',
      iconKey: 'Footprints',
      address: selectedPlace.address,
      directionsUrl: getPlaceDirectionsUrl(selectedPlace, currentPosition),
    }

    try {
      const planItems = getSavedPlannerBreaks().filter(
        (plannedBreak) => plannedBreak.placeId !== selectedPlace.id,
      )

      localStorage.setItem(plannerStorageKey, JSON.stringify([...planItems, savedBreak]))
      setPlannedPlaceIds((currentIds) => new Set(currentIds).add(selectedPlace.id))
    } catch {
      setError('This break could not be added to your planner.')
    }
  }

  return (
    <section className="explore-workspace">
      <MapContainer
        center={melbourneCenter}
        className="leaflet-workspace-map"
        scrollWheelZoom
        zoom={defaultMapZoom}
      >
        <CurrentLocationView position={currentPosition} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {visiblePlaces.map((place) => (
          <Marker
            icon={createMarkerIcon(place.displayMarker, place.markerTone)}
            key={place.id}
            position={place.position}
            eventHandlers={{
              click: () => setSelectedPlace(place),
            }}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {getPlaceCategory(place)}
              <br />
              Total: {place.estimated_total_time ?? 'Unknown'} min
              <br />
              {getPlaceFitLabel(place, selectedDuration)}
            </Popup>
          </Marker>
        ))}

        {currentPosition ? (
          <Marker icon={createCurrentLocationIcon()} position={currentPosition}>
            <Popup>
              <strong>{originLabel}</strong>
              <br />
              Starting point
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <Card className="map-control-panel">
        <h1>Explore nearby breaks</h1>

        <div className="near-heading-row">
          <h2>
            Near <strong>{originLabel}</strong>
          </h2>
          <button
            aria-label="Use current location"
            disabled={isLocating}
            onClick={handleUseCurrentLocation}
            title="Use current location"
            type="button"
          >
            <Crosshair size={18} />
          </button>
        </div>

        {locationStatus ? <p className="map-status-message">{locationStatus}</p> : null}

        <div className="map-test-origin-control" aria-label="Choose where recommendations start from">
          <span>Recommend from</span>
          <div>
            {testOriginOptions.map((testOrigin) => (
              <button
                className={originLabel === testOrigin.label ? 'selected' : ''}
                key={testOrigin.label}
                onClick={() => handleTestOriginChange(testOrigin)}
                type="button"
              >
                {testOrigin.label}
              </button>
            ))}
            <button onClick={handleRandomTestOrigin} type="button">
              Random
            </button>
          </div>
        </div>

        <div className="map-duration-control" aria-label="Choose available break time">
          <span>Available time</span>
          <div>
            {durationOptions.map((duration) => (
              <button
                aria-pressed={duration === selectedDuration}
                className={duration === selectedDuration ? 'selected' : ''}
                key={duration}
                onClick={() => handleDurationChange(duration)}
                type="button"
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>

        <div className="category-tabs" aria-label="Map category filters">
          {categoryOptions.map((category) => (
            <button
              className={category === selectedCategory ? 'selected' : ''}
              key={category}
              onClick={() => setSelectedCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="nearby-results-heading">Recommended nearby breaks</div>

        {error ? <p className="map-status-message">{error}</p> : null}
        {!isLoading && !error && filteredPlaces.length === 0 ? (
          <p className="map-status-message">No locations match the current category.</p>
        ) : null}

        <div className="map-result-list">
          {visiblePlaces.map((place) => {
            const PlaceIcon = placeIcons[getPlaceCategory(place)] ?? placeIcons[place.type] ?? MapPin
            const isSelected = selectedPlace?.id === place.id
            const suitability = getPlaceFitLabel(place, selectedDuration)

            return (
              <button
                className={isSelected ? 'map-result-card selected' : 'map-result-card'}
                key={place.id}
                onClick={() => setSelectedPlace(place)}
                type="button"
              >
                <span className={`result-number ${place.markerTone}`}>{place.displayMarker}</span>
                <div>
                  <h3>{place.name}</h3>
                  <p>{getPlaceCategory(place)}</p>
                  <small>
                    <Navigation size={13} />
                    {place.distance_m ? `${place.distance_m} m · ` : ''}
                    {getWalkTimeLabel(place)} each way
                  </small>
                  <small className="time-fit-status">
                    <Clock3 size={13} />
                    {suitability}
                  </small>
                </div>
                <PlaceIcon className="result-icon" size={18} />
              </button>
            )
          })}
        </div>

        <div className="panel-footer-row">
          <span>
            {isLoading
              ? 'Calculating time-safe options'
              : `Showing ${visiblePlaces.length} of ${filteredPlaces.length} recommendations`}
          </span>
          <span>{selectedDuration} min break</span>
          <Link to="/mission">View mission options</Link>
        </div>
      </Card>

      {selectedPlace ? (
        <Card className="selected-place-card">
          <button
            aria-label="Close place preview"
            className="close-card-button"
            onClick={() => setSelectedPlace(null)}
            type="button"
          >
            <X size={18} />
          </button>

          <div className="selected-title-row">
            <span className={`result-number ${selectedPlace.markerTone}`}>
              {visiblePlaces.find((place) => place.id === selectedPlace.id)?.displayMarker ?? selectedPlace.marker}
            </span>
            <div>
              <h2>{selectedPlace.name}</h2>
              <p>{getPlaceCategory(selectedPlace)}</p>
            </div>
          </div>

          <div className="selected-detail-list">
            <span>
              <MapPin size={16} />
              {selectedPlace.address ?? 'Address unavailable'}
            </span>
          </div>

          <div className="route-breakdown place-breakdown">
            <span>
              <Footprints size={16} />
              <strong>Walk there</strong>
              {getWalkTimeLabel(selectedPlace)}
            </span>
            <span>
              <Leaf size={16} />
              <strong>Rest</strong>
              {selectedPlace.activity_time} min
            </span>
            <span>
              <Footprints size={16} />
              <strong>Walk back</strong>
              {getWalkTimeLabel(selectedPlace)}
            </span>
            <span>
              <Clock3 size={16} />
              <strong>Buffer</strong>
              {selectedPlace.buffer_time} min
            </span>
          </div>

          <div className="selected-detail-list compact">
            <span>
              <Clock3 size={16} />
              About {selectedPlace.estimated_total_time} min including buffer
            </span>
          </div>

          <div className="selected-break-summary">
            <strong>{selectedPlaceSuitability}</strong>
            <span>{getPlaceSpareLabel(selectedPlace)}</span>
            <span>{selectedPlace.distance_m} m away</span>
          </div>

          <div className="selected-place-actions">
            <Button asChild variant="success">
              <Link
                to="/guided/outdoor"
                state={{ breakPlan: getOutdoorBreakPlan(selectedPlace, selectedDuration, currentPosition) }}
              >
                <Play size={17} fill="currentColor" />
                Start break
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={getPlaceDirectionsUrl(selectedPlace, currentPosition)} rel="noreferrer" target="_blank">
                <Navigation size={17} />
                Directions
              </a>
            </Button>
            <Button
              disabled={plannedPlaceIds.has(selectedPlace.id)}
              onClick={handleAddSelectedPlaceToPlanner}
              type="button"
              variant="outline"
            >
              {plannedPlaceIds.has(selectedPlace.id) ? <CheckCircle2 size={17} /> : <CalendarPlus size={17} />}
              {plannedPlaceIds.has(selectedPlace.id) ? 'Added' : 'Add to planner'}
            </Button>
          </div>
        </Card>
      ) : null}
    </section>
  )
}

export default ExploreMap
