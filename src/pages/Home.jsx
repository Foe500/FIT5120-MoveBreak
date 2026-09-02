import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  MapPin,
  Smile,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import BreakHero from '../components/BreakHero.jsx'
import RecommendedMissionCard from '../components/RecommendedMissionCard.jsx'
import QuickIndoorBreakCard from '../components/home/QuickIndoorBreakCard.jsx'
import SessionBadgesCard from '../components/home/SessionBadgesCard.jsx'
import TodayPlanCard from '../components/home/TodayPlanCard.jsx'
import { Card } from '@/components/ui/card'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'
import { melbourneCenter } from '@/data/mapPlaces'
import { API_BASE_URL } from '@/lib/api'
import { createMarkerIcon } from '@/lib/mapMarkers'

function Home() {
  // Keep duration unselected until Emily actively chooses 5, 10 or 15 minutes.
  const [selectedDuration, setSelectedDuration] = useState(null)
  const [durationError, setDurationError] = useState('')
  const [places, setPlaces] = useState([])

  function handleDurationChange(duration) {
    setSelectedDuration(duration)
    setDurationError('')
  }

  function handleMissingDuration() {
    // BreakHero owns the button click, but Home owns the validation message state.
    setDurationError('Choose how much time you have before finding your break.')
  }

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
        setPlaces([])
      }
    }

    loadPlaces()
  }, [])

  return (
    <section className="home-dashboard home-redesign">
      <section className="home-hero-shell">
        <div className="home-hero-copy">
          <span className="home-eyebrow">
            <Sparkles size={15} />
            A small pause for a better study day
          </span>
          <BreakHero
            durationError={durationError}
            onMissingDuration={handleMissingDuration}
            selectedDuration={selectedDuration}
            onDurationChange={handleDurationChange}
          />
        </div>

        <div className="home-hero-visual" aria-label="A student taking a movement break beside a desk">
          <span className="hero-shape hero-shape-blue" aria-hidden="true"></span>
          <span className="hero-shape hero-shape-green" aria-hidden="true"></span>
          <img src={shoulderReleaseImage} alt="Person stretching beside a study desk" />
          <div className="hero-benefit-card">
            <CheckCircle2 size={20} />
            <div>
              <strong>Short, guided and achievable</strong>
              <span>2–15 minute resets for busy study days</span>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-it-works-title">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">How it works</span>
            <h2 id="how-it-works-title">Your reset in three simple steps</h2>
          </div>
          <Link className="section-text-link" to="/mission">
            Find my break
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="journey-step-grid">
          <article className="journey-step journey-step-sage">
            <span className="step-number">1</span>
            <Smile size={28} aria-hidden="true" />
            <h3>Choose how you feel</h3>
            <p>Tell us your available time, space and what your body needs.</p>
          </article>
          <article className="journey-step journey-step-blue">
            <span className="step-number">2</span>
            <TimerReset size={28} aria-hidden="true" />
            <h3>Follow a short break</h3>
            <p>Get a guided indoor activity or a nearby outdoor reset.</p>
          </article>
          <article className="journey-step journey-step-coral">
            <span className="step-number">3</span>
            <Sparkles size={28} aria-hidden="true" />
            <h3>Return refreshed</h3>
            <p>Come back re-energised and ready to focus on what matters.</p>
          </article>
        </div>
      </section>

      <section className="home-feature-grid">
        <RecommendedMissionCard duration={selectedDuration} />

        <Card className="map-card">
          <div className="card-title-row">
            <div className="title-with-icon">
              <MapPin size={19} />
              <div>
                <span className="section-kicker">Outdoor option</span>
                <h2>Find a place to move</h2>
              </div>
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

              {places.map((place) => (
                <Marker
                  icon={createMarkerIcon(place.marker, place.markerTone)}
                  key={place.id}
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
              Open the map
              <ArrowRight size={15} />
            </Link>
          </div>
        </Card>
      </section>

      <div className="dashboard-bottom">
        <TodayPlanCard />
        <SessionBadgesCard />
        <QuickIndoorBreakCard />
      </div>

      <aside className="bottom-callout">
        <HeartPulse size={18} />
        <strong>Small breaks. Big difference.</strong>
        <span>Short breaks improve focus, wellbeing and bring more energy to your day.</span>
        <Link to="/mission">
          Find a break
          <ArrowRight size={15} />
        </Link>
      </aside>
    </section>
  )
}

export default Home
