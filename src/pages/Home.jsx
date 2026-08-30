import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Map } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import BreakHero from '../components/BreakHero.jsx'
import RecommendedMissionCard from '../components/RecommendedMissionCard.jsx'
import QuickIndoorBreakCard from '../components/home/QuickIndoorBreakCard.jsx'
import SessionBadgesCard from '../components/home/SessionBadgesCard.jsx'
import TodayPlanCard from '../components/home/TodayPlanCard.jsx'
import { mapPlaces, melbourneCenter } from '@/data/mapPlaces'
import { createMarkerIcon } from '@/lib/mapMarkers'

function Home() {
  const [selectedDuration, setSelectedDuration] = useState(5)

  return (
    <section className="home-dashboard">
      <div className="dashboard-main">
        <div className="break-column">
          <section className="break-card">
            <BreakHero
              selectedDuration={selectedDuration}
              onDurationChange={setSelectedDuration}
            />
          </section>
          <RecommendedMissionCard duration={selectedDuration} />
        </div>

        <section className="map-card">
          <div className="card-title-row">
            <div className="title-with-icon">
              <Map size={19} />
              <h2>Your Nearby Map</h2>
            </div>
            <div className="zone-legend">
              <span className="green-dot">5 min zone</span>
              <span className="gold-dot">10 min zone</span>
              <span className="blue-dot">15 min zone</span>
            </div>
          </div>

          <div className="home-leaflet-map-wrap">
            <MapContainer
              center={melbourneCenter}
              className="home-leaflet-map"
              dragging={false}
              scrollWheelZoom={false}
              zoom={14}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                    {place.distance}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <Link className="open-map-overlay" to="/explore">
              Open Explore Map
            </Link>
          </div>
        </section>
      </div>

      <div className="dashboard-bottom">
        <TodayPlanCard />
        <SessionBadgesCard />
        <QuickIndoorBreakCard />
      </div>

      <aside className="bottom-callout">
        <HeartPulse size={18} />
        <strong>Small breaks. Big difference.</strong>
        <span>Short breaks improve focus, wellbeing and bring more energy to your day.</span>
        <Link to="/mission">You've got this.</Link>
      </aside>
    </section>
  )
}

export default Home
