import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
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
import { createMarkerIcon } from '@/lib/mapMarkers'

const categories = ['All', 'Green space', 'Quiet space', 'Landmark', 'Waterfront']

const placeIcons = {
  'Green space': Leaf,
  'Waterfront green space': Leaf,
  'Quiet public space': Building2,
  'Open public square': Landmark,
}

function ExploreMap() {
  const [places, setPlaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const selectedPlace = places[0]

  useEffect(() => {
    async function loadPlaces() {
      try {
        const response = await fetch(`${API_BASE_URL}/places`)

        if (!response.ok) {
          throw new Error('Failed to load places')
        }

        const data = await response.json()
        setPlaces(data)
      } catch {
        setError('Map places are unavailable right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadPlaces()
  }, [])

  return (
    <section className="explore-workspace">
      <MapContainer
        center={melbourneCenter}
        className="leaflet-workspace-map"
        scrollWheelZoom
        zoom={14}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {places.map((place) => (
          <Marker
            icon={createMarkerIcon(place.marker, place.markerTone)}
            key={place.id}
            position={place.position}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.type}
              <br />
              {place.distance}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <Card className="map-control-panel">
        <h1>Explore nearby breaks</h1>
        <label className="map-search-box">
          <Search size={18} />
          <span>Search parks, quiet spaces...</span>
        </label>

        <div className="near-heading-row">
          <h2>
            Near <strong>Melbourne CBD</strong>
          </h2>
          <button aria-label="Use current location" type="button">
            <Crosshair size={18} />
          </button>
        </div>

        <div className="category-tabs" aria-label="Map category filters">
          {categories.map((category) => (
            <button className={category === 'All' ? 'selected' : ''} key={category} type="button">
              {category}
            </button>
          ))}
        </div>

        <div className="nearby-results-heading">Nearby break spots</div>

        {error ? <p className="map-status-message">{error}</p> : null}

        <div className="map-result-list">
          {places.map((place) => {
            const PlaceIcon = placeIcons[place.type] ?? MapPin

            return (
              <article key={place.id}>
                <span className={`result-number ${place.markerTone}`}>{place.marker}</span>
                <div>
                  <h3>{place.name}</h3>
                  <p>{place.type}</p>
                  <small>
                    <Navigation size={13} />
                    {place.distance}
                  </small>
                </div>
                <Badge variant="secondary">{place.status}</Badge>
                <PlaceIcon className="result-icon" size={18} />
              </article>
            )
          })}
        </div>

        <div className="panel-footer-row">
          <span>{isLoading ? 'Loading nearby options' : `Showing ${places.length} nearby options`}</span>
          <Link to="/mission">View mission options</Link>
        </div>
      </Card>

      {selectedPlace ? (
        <Card className="selected-place-card">
        <button aria-label="Close place preview" className="close-card-button" type="button">
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
            Best for a 10 min outdoor reset
          </span>
        </div>

        <div className="accepted-tags">
          <span>Green</span>
          <span>Quiet</span>
          <span>Seating</span>
          <span>Low traffic</span>
        </div>

        <Button asChild className="directions-button">
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
