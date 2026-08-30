import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import {
  Clock3,
  Crosshair,
  MapPin,
  Navigation,
  Route,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mapPlaces, melbourneCenter } from '@/data/mapPlaces'
import { createMarkerIcon } from '@/lib/mapMarkers'

const categories = ['All', 'Green space', 'Quiet space', 'Landmark', 'Waterfront']

function ExploreMap() {
  const selectedPlace = mapPlaces[0]

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

        {mapPlaces.map((place) => (
          <Marker
            icon={createMarkerIcon(place.marker, place.markerTone)}
            key={place.name}
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

        <div className="map-result-list">
          {mapPlaces.map((place) => {
            const PlaceIcon = place.icon

            return (
              <article key={place.name}>
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
          <span>Showing 4 nearby options</span>
          <Link to="/mission">View mission options</Link>
        </div>
      </Card>

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
    </section>
  )
}

export default ExploreMap
