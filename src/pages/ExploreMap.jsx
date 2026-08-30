import { Link } from 'react-router-dom'
import {
  Building2,
  Clock3,
  Crosshair,
  Footprints,
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
    className: 'map-marker-flagstaff',
  },
  {
    icon: Leaf,
    name: 'Docklands Park',
    type: 'Waterfront green space',
    distance: '9 min walk',
    status: 'Open now',
    marker: '2',
    markerTone: 'gold',
    className: 'map-marker-docklands',
  },
  {
    icon: Building2,
    name: 'State Library Victoria',
    type: 'Quiet public space',
    distance: '11 min walk',
    status: 'Low noise',
    marker: '3',
    markerTone: 'blue',
    className: 'map-marker-library',
  },
  {
    icon: Landmark,
    name: 'Federation Square',
    type: 'Open public square',
    distance: '14 min walk',
    status: 'Outdoor',
    marker: '4',
    markerTone: 'gold',
    className: 'map-marker-fed',
  },
]

function ExploreMap() {
  const selectedPlace = mapPlaces[0]

  return (
    <section className="explore-workspace">
      <div className="full-map" aria-label="Melbourne nearby breaks map">
        <div className="map-river-large"></div>
        <div className="major-road road-east"></div>
        <div className="major-road road-west"></div>
        <div className="major-road road-south"></div>
        <span className="map-district district-cbd">Melbourne</span>
        <span className="map-district district-north">Carlton</span>
        <span className="map-district district-east">Fitzroy</span>
        <span className="map-district district-south">Southbank</span>

        {mapPlaces.map((place) => (
          <span
            className={`numbered-marker ${place.markerTone} ${place.className}`}
            data-marker={place.marker}
            key={place.name}
          >
          </span>
        ))}

        <span className="user-location-marker">
          <Footprints size={20} />
        </span>
      </div>

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
            const Icon = place.icon

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
                <Icon className="result-icon" size={18} />
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
            William Street, West Melbourne
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
