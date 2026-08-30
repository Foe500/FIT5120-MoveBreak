import { Link } from 'react-router-dom'
import { Icon } from 'leaflet'
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

const melbourneCenter = [-37.8136, 144.9631]

const categories = ['All', 'Green space', 'Quiet space', 'Landmark', 'Waterfront']

const mapPlaces = [
  {
    icon: Leaf,
    name: 'Flagstaff Gardens',
    type: 'Green space',
    distance: '4 min walk',
    status: 'Best match',
    marker: '1',
    markerTone: 'green',
    position: [-37.8101, 144.955],
    address: 'William Street, West Melbourne',
  },
  {
    icon: Leaf,
    name: 'Docklands Park',
    type: 'Waterfront green space',
    distance: '9 min walk',
    status: 'Open now',
    marker: '2',
    markerTone: 'gold',
    position: [-37.8217, 144.9475],
    address: 'Harbour Esplanade, Docklands',
  },
  {
    icon: Building2,
    name: 'State Library Victoria',
    type: 'Quiet public space',
    distance: '11 min walk',
    status: 'Low noise',
    marker: '3',
    markerTone: 'blue',
    position: [-37.8098, 144.9652],
    address: '328 Swanston Street, Melbourne',
  },
  {
    icon: Landmark,
    name: 'Federation Square',
    type: 'Open public square',
    distance: '14 min walk',
    status: 'Outdoor',
    marker: '4',
    markerTone: 'gold',
    position: [-37.8179, 144.9691],
    address: 'Swanston Street, Melbourne',
  },
]

const markerColors = {
  green: '#08713f',
  gold: '#f28c22',
  blue: '#0b66df',
}

function createMarkerIcon(marker, tone) {
  const color = markerColors[tone]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><path fill="${color}" stroke="white" stroke-width="3" d="M21 3c8.3 0 15 6.4 15 14.4 0 10.6-15 21.6-15 21.6S6 28 6 17.4C6 9.4 12.7 3 21 3Z"/><text x="21" y="23" text-anchor="middle" fill="white" font-family="Arial" font-size="15" font-weight="700">${marker}</text></svg>`

  return new Icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
    popupAnchor: [0, -36],
  })
}

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

        <p className="sample-data-note">
          Sample locations for Iteration 1. Later this can be replaced with Open Data.
        </p>

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
          <span>Showing 4 sample options</span>
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
