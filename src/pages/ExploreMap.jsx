import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  ArrowLeft,
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
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { melbourneCenter } from '@/data/mapPlaces'
import { API_BASE_URL } from '@/lib/api'
import { createCurrentLocationIcon, createMarkerIcon } from '@/lib/mapMarkers'
import { saveOutdoorBreakSession } from '@/lib/outdoorBreak'
import { getSavedPlannerBreaks, savePlannerBreaks } from '@/lib/plannerStorage'

const defaultMapZoom = 14
const currentLocationZoom = 16
const defaultOutdoorBreakDuration = 15
const maxVisiblePlaces = 40
const durationOptions = [5, 15, 30]
const plannerStorageKey = 'movebreak-planned-breaks'
const locationSuggestions = [
  {
    label: 'Flagstaff Gardens',
    address: 'Flagstaff Gardens, Melbourne VIC',
    position: [-37.8111222889277, 144.954696055235],
  },
  {
    label: 'Federation Square',
    address: 'Federation Square, Melbourne VIC',
    position: [-37.8178516571684, 144.968963600783],
  },
  {
    label: 'Argyle Square',
    address: 'Argyle Square, Melbourne VIC',
    position: [-37.8031480577285, 144.965761295089],
  },
  {
    label: 'Fitzroy Gardens',
    address: 'Fitzroy Gardens, Melbourne VIC',
    position: [-37.8129616331579, 144.980455714669],
  },
  {
    label: 'Kings Domain',
    address: 'Kings Domain, Melbourne VIC',
    position: [-37.8255239795833, 144.974107925144],
  },
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

function getInitialPosition(searchParams) {
  const latitudeParam = searchParams.get('lat')
  const longitudeParam = searchParams.get('lng')

  if (latitudeParam === null || longitudeParam === null) {
    return null
  }

  const latitude = Number(latitudeParam)
  const longitude = Number(longitudeParam)

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return [latitude, longitude]
  }

  return null
}

function getPlaceFitLabel(place) {
  return place.is_time_safe ? 'Recommended for this break' : 'Outside current time range'
}

function getPlaceSpareLabel(place) {
  return place.remaining_time !== undefined ? `${Math.round(place.remaining_time)} min spare` : 'Spare time unavailable'
}

function getWalkTimeLabel(place) {
  return place.walking_time_one_way_label ?? `${place.walking_time_one_way} min`
}

function getPlaceTotalTimeLabel(place) {
  return place.estimated_total_time ? `${place.estimated_total_time} min total` : 'Total time unavailable'
}

function getShortLocationLabel(label) {
  return label.split(',').slice(0, 2).join(',').trim()
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedDuration = getInitialDuration(searchParams)
  const selectedNeed = searchParams.get('need') ?? ''
  const requestedPlaceId = searchParams.get('place')
  const [initialPosition] = useState(() => getInitialPosition(searchParams))
  const [places, setPlaces] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPosition, setCurrentPosition] = useState(initialPosition)
  const [originLabel, setOriginLabel] = useState(
    initialPosition ? 'Current location' : 'Melbourne CBD',
  )
  const [locationQuery, setLocationQuery] = useState('')
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [plannedPlaceIds, setPlannedPlaceIds] = useState(
    () => new Set(getSavedPlannerBreaks().map((plannedBreak) => plannedBreak.placeId).filter(Boolean)),
  )
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
    if (!initialPosition) {
      return
    }

    let isActive = true

    async function loadInitialAddress() {
      try {
        const query = new URLSearchParams({
          lat: String(initialPosition[0]),
          lng: String(initialPosition[1]),
        })
        const response = await fetch(`${API_BASE_URL}/reverse-geocode?${query.toString()}`)
        if (!response.ok) {
          throw new Error('Address lookup failed')
        }

        const result = await response.json()
        const shortLabel = getShortLocationLabel(result.label) || 'Current location'

        if (isActive) {
          setOriginLabel(shortLabel)
          setLocationQuery(shortLabel)
        }
      } catch {
        if (isActive) {
          setLocationQuery('Current location')
        }
      }
    }

    loadInitialAddress()

    return () => {
      isActive = false
    }
  }, [initialPosition])

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
        if (selectedNeed) {
          query.set('need', selectedNeed)
        }
        const response = await fetch(`${API_BASE_URL}/recommendations?${query.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to load recommendations')
        }

        const data = await response.json()
        const recommendations = data.recommendations ?? []
        setPlaces(recommendations)
        setSelectedPlace(
          recommendations.find((place) => String(place.id) === requestedPlaceId) ?? null,
        )
        setSelectedCategory('All')
        // No place is selected by default — the detail card only opens
        // once the user actively picks one from the map or the list.
      } catch {
        setError('Time-safe recommendations are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [currentPosition, requestedPlaceId, selectedDuration, selectedNeed])

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Current location is not supported in this browser.')
      return
    }

    setIsLocating(true)
    setLocationStatus('Finding your current location...')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextPosition = [position.coords.latitude, position.coords.longitude]
        const nextSearchParams = new URLSearchParams(searchParams)

        setCurrentPosition(nextPosition)
        setOriginLabel('Current location')
        setLocationQuery('Current location')
        setLocationStatus('Finding your address...')
        setSelectedPlace(null)
        nextSearchParams.set('lat', String(nextPosition[0]))
        nextSearchParams.set('lng', String(nextPosition[1]))
        nextSearchParams.delete('place')
        setSearchParams(nextSearchParams)

        try {
          const query = new URLSearchParams({
            lat: String(nextPosition[0]),
            lng: String(nextPosition[1]),
          })
          const response = await fetch(`${API_BASE_URL}/reverse-geocode?${query.toString()}`)
          if (!response.ok) {
            throw new Error('Address lookup failed')
          }

          const result = await response.json()
          const shortLabel = getShortLocationLabel(result.label) || 'Current location'
          setOriginLabel(shortLabel)
          setLocationQuery(shortLabel)
          setLocationStatus('')
        } catch {
          setLocationStatus('Using your current location. The street address is unavailable.')
        } finally {
          setIsLocating(false)
        }
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

  async function handleLocationSearch(event) {
    event.preventDefault()
    setIsSuggestionsOpen(false)

    const query = locationQuery.trim()
    if (!query) {
      setLocationStatus('Enter a suburb, postcode or street address.')
      return
    }

    setIsGeocoding(true)
    setLocationStatus('Finding that location...')

    try {
      const response = await fetch(`${API_BASE_URL}/geocode?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error('Location not found')
      }

      const result = await response.json()
      const nextPosition = [result.latitude, result.longitude]
      const shortLabel = getShortLocationLabel(result.label)
      const nextSearchParams = new URLSearchParams(searchParams)

      nextSearchParams.set('lat', String(result.latitude))
      nextSearchParams.set('lng', String(result.longitude))
      nextSearchParams.delete('place')
      setSearchParams(nextSearchParams)
      setCurrentPosition(nextPosition)
      setOriginLabel(shortLabel || query)
      setLocationStatus('')
      setSelectedPlace(null)
    } catch {
      setLocationStatus('Location not found. Try adding a suburb, state or postcode.')
    } finally {
      setIsGeocoding(false)
    }
  }

  function handleSuggestedLocation(suggestion) {
    const nextSearchParams = new URLSearchParams(searchParams)

    nextSearchParams.set('lat', String(suggestion.position[0]))
    nextSearchParams.set('lng', String(suggestion.position[1]))
    nextSearchParams.delete('place')
    setSearchParams(nextSearchParams)
    setCurrentPosition(suggestion.position)
    setOriginLabel(suggestion.label)
    setLocationQuery(suggestion.address)
    setLocationStatus('')
    setSelectedPlace(null)
    setIsSuggestionsOpen(false)
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

      savePlannerBreaks([...planItems, savedBreak])
      setPlannedPlaceIds((currentIds) => new Set(currentIds).add(selectedPlace.id))
    } catch {
      setError('This break could not be added to your planner.')
    }
  }

  function handleStartOutdoorBreak() {
    if (!selectedPlace) {
      return
    }

    saveOutdoorBreakSession(getOutdoorBreakPlan(selectedPlace, selectedDuration, currentPosition))
  }

  return (
    <section className="explore-workspace">
      <MapContainer
        center={currentPosition ?? melbourneCenter}
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
              {getPlaceFitLabel(place)}
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

        <form className="map-location-search" onSubmit={handleLocationSearch}>
          <label htmlFor="map-location-query">Starting location</label>
          <div className="map-location-input-row">
            <MapPin size={17} aria-hidden="true" />
            <input
              autoComplete="street-address"
              id="map-location-query"
              onBlur={() => setIsSuggestionsOpen(false)}
              onChange={(event) => {
                setLocationQuery(event.target.value)
                setIsSuggestionsOpen(true)
              }}
              onFocus={() => setIsSuggestionsOpen(true)}
              placeholder="Suburb, postcode or address"
              type="search"
              value={locationQuery}
            />
            <button disabled={isGeocoding} type="submit">
              <Search size={17} aria-hidden="true" />
              <span>{isGeocoding ? 'Finding' : 'Find'}</span>
            </button>
          </div>
          {isSuggestionsOpen ? (
            <div className="map-location-suggestions" aria-label="Popular locations">
              <span>Popular locations</span>
              {locationSuggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSuggestedLocation(suggestion)}
                  type="button"
                >
                  <MapPin size={15} aria-hidden="true" />
                  <span>
                    <strong>{suggestion.label}</strong>
                    <small>{suggestion.address}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </form>

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
                  <div className="result-meta-row">
                    <small>
                      <Navigation size={13} />
                      {place.distance_m ? `${place.distance_m} m · ` : ''}
                      {getWalkTimeLabel(place)} each way
                    </small>
                    <small className="time-total-status">
                      <Clock3 size={13} />
                      {getPlaceTotalTimeLabel(place)}
                    </small>
                  </div>
                </div>
                <PlaceIcon className="result-icon" size={18} />
              </button>
            )
          })}
        </div>

        <div className="panel-footer-row">
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (window.history.state?.idx > 0) {
                navigate(-1)
              } else {
                navigate(`/mission?duration=${selectedDuration}`, { replace: true })
              }
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Go back
          </Button>
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

          <div className="selected-total-time">
            <Clock3 size={16} />
            Estimated total: {selectedPlace.estimated_total_time} min
          </div>

          <div className="selected-break-summary">
            <span>{getPlaceSpareLabel(selectedPlace)}</span>
            <span>{selectedPlace.distance_m} m away</span>
          </div>

          <div className="selected-place-actions">
            <Button asChild variant="success">
              <Link
                onClick={handleStartOutdoorBreak}
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
