import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  Building2,
  Clock3,
  Crosshair,
  Landmark,
  Leaf,
  MapPin,
  Navigation,
  Route,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { melbourneCenter } from '@/data/mapPlaces'
import { API_BASE_URL } from '@/lib/api'
import { createCurrentLocationIcon, createMarkerIcon } from '@/lib/mapMarkers'

const defaultMapZoom = 14
const currentLocationZoom = 16
const defaultOutdoorBreakDuration = 10
const durationOptions = [5, 10, 15]

const placeIcons = {
  'Green space': Leaf,
  'Waterfront green space': Leaf,
  'Quiet public space': Building2,
  'Open public square': Landmark,
}

const defaultDataSource = {
  provider: 'City of Melbourne Open Data',
  dataset: 'Open Space / Public Places',
  sourceType: 'Open Data',
}

function getPlaceCategory(place) {
  // Prefer the future DS-provided category, but keep type as a fallback for the current dataset.
  return place.category ?? place.type
}

function getPlaceDataSource(place) {
  // Keep the UI data-driven when DS adds source metadata, while still showing a safe I1 fallback.
  return {
    ...defaultDataSource,
    ...place.dataSource,
  }
}

function getInitialDuration(searchParams) {
  const duration = Number(searchParams.get('duration'))

  return durationOptions.includes(duration) ? duration : defaultOutdoorBreakDuration
}

function getPlaceSuitability(place, duration) {
  const savedSuitability = place.suitabilityByDuration?.[duration]

  if (savedSuitability) {
    return savedSuitability
  }

  // I1 uses a basic time-fit indicator until DS provides route-based walking time fields.
  const bestDuration = Number(place.bestDurationMinutes ?? defaultOutdoorBreakDuration)

  return duration >= bestDuration ? 'Suitable' : 'Outside current time range'
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
  const [searchParams] = useSearchParams()
  const selectedDuration = getInitialDuration(searchParams)
  const [places, setPlaces] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPosition, setCurrentPosition] = useState(null)
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const selectedPlaceDataSource = selectedPlace ? getPlaceDataSource(selectedPlace) : null
  const selectedPlaceSuitability = selectedPlace
    ? getPlaceSuitability(selectedPlace, selectedDuration)
    : null
  const categoryOptions = useMemo(
    // Build category buttons from place data so new DS categories appear without frontend changes.
    () => ['All', ...new Set(places.map((place) => getPlaceCategory(place)).filter(Boolean))],
    [places],
  )
  const filteredPlaces = useMemo(
    () =>
      places.filter((place) => {
        const category = getPlaceCategory(place)
        const dataSource = getPlaceDataSource(place)
        const searchText = [
          place.name,
          category,
          place.type,
          place.address,
          place.status,
          dataSource.provider,
          dataSource.dataset,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const matchesSearch = searchText.includes(searchQuery.trim().toLowerCase())
        const matchesCategory = selectedCategory === 'All' || category === selectedCategory

        return matchesSearch && matchesCategory
      }),
    [places, searchQuery, selectedCategory],
  )

  useEffect(() => {
    if (!filteredPlaces.length) {
      setSelectedPlace(null)
      return
    }

    // Keep the detail card aligned with the filtered map/list after search or category changes.
    if (!selectedPlace || !filteredPlaces.some((place) => place.id === selectedPlace.id)) {
      setSelectedPlace(filteredPlaces[0])
    }
  }, [filteredPlaces, selectedPlace])

  useEffect(() => {
    async function loadPlaces() {
      try {
        const response = await fetch(`${API_BASE_URL}/places`)

        if (!response.ok) {
          throw new Error('Failed to load places')
        }

        const data = await response.json()
        setPlaces(data)
        setSelectedPlace(data[0] ?? null)
      } catch {
        setError('Map places are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadPlaces()
  }, [])

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

        {filteredPlaces.map((place) => (
          <Marker
            icon={createMarkerIcon(place.marker, place.markerTone)}
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
              Time fit: {getPlaceSuitability(place, selectedDuration)}
              <br />
              Source: {getPlaceDataSource(place).provider}
            </Popup>
          </Marker>
        ))}

        {currentPosition ? (
          <Marker icon={createCurrentLocationIcon()} position={currentPosition}>
            <Popup>
              <strong>You are here</strong>
              <br />
              Current location
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <Card className="map-control-panel">
        <h1>Explore nearby breaks</h1>
        <label className="map-search-box">
          <Search size={18} />
          <input
            aria-label="Search map locations"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search parks, quiet spaces..."
            type="search"
            value={searchQuery}
          />
        </label>

        <div className="near-heading-row">
          <h2>
            Near <strong>Melbourne CBD</strong>
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

        <div className="nearby-results-heading">Nearby break spots</div>

        {error ? <p className="map-status-message">{error}</p> : null}
        {!isLoading && !error && filteredPlaces.length === 0 ? (
          <p className="map-status-message">No locations match the current search or category.</p>
        ) : null}

        <div className="map-result-list">
          {filteredPlaces.map((place) => {
            const PlaceIcon = placeIcons[getPlaceCategory(place)] ?? placeIcons[place.type] ?? MapPin
            const isSelected = selectedPlace?.id === place.id
            const suitability = getPlaceSuitability(place, selectedDuration)

            return (
              <button
                className={isSelected ? 'map-result-card selected' : 'map-result-card'}
                key={place.id}
                onClick={() => setSelectedPlace(place)}
                type="button"
              >
                <span className={`result-number ${place.markerTone}`}>{place.marker}</span>
                <div>
                  <h3>{place.name}</h3>
                  <p>{getPlaceCategory(place)}</p>
                  <small>
                    <Navigation size={13} />
                    {place.distance}
                  </small>
                  <small className="time-fit-status">
                    <Clock3 size={13} />
                    {suitability}
                  </small>
                </div>
                <Badge variant="secondary">{place.status}</Badge>
                <PlaceIcon className="result-icon" size={18} />
              </button>
            )
          })}
        </div>

        <div className="panel-footer-row">
          <span>{isLoading ? 'Loading nearby options' : `Showing ${filteredPlaces.length} nearby options`}</span>
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
              {selectedPlace.marker}
            </span>
            <div>
              <h2>{selectedPlace.name}</h2>
              <Badge variant="success">{selectedPlace.status}</Badge>
            </div>
          </div>

          <div className="selected-detail-list">
            <span>
              <MapPin size={16} />
              {selectedPlace.address}
            </span>
            <span>
              <Navigation size={16} />
              {selectedPlace.distance}
            </span>
            <span>
              <Clock3 size={16} />
              {selectedPlaceSuitability} for a {selectedDuration} min break
            </span>
            <span>
              <Clock3 size={16} />
              Basic I1 indicator, not a full route-time calculation
            </span>
            <span>
              <Landmark size={16} />
              {getPlaceCategory(selectedPlace)}
            </span>
            <span>
              <Building2 size={16} />
              Source: {selectedPlaceDataSource.provider}
            </span>
            <span>
              <Building2 size={16} />
              Dataset: {selectedPlaceDataSource.dataset}
            </span>
          </div>

          <div className="accepted-tags">
            <span>{selectedPlaceSuitability}</span>
            <span>Green</span>
            <span>Quiet</span>
            <span>Seating</span>
            <span>Low traffic</span>
          </div>

          <Button asChild className="mt-[1.05rem] w-full" variant="success">
            <Link to="/mission">
              <Route size={17} />
              Use this break spot
            </Link>
          </Button>
        </Card>
      ) : null}
    </section>
  )
}

export default ExploreMap
