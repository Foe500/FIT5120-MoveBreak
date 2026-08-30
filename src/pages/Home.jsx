import { Link } from 'react-router-dom'
import {
  Building2,
  Footprints,
  HeartPulse,
  Landmark,
  Leaf,
  Map,
} from 'lucide-react'
import BreakHero from '../components/BreakHero.jsx'
import RecommendedMissionCard from '../components/RecommendedMissionCard.jsx'
import QuickIndoorBreakCard from '../components/home/QuickIndoorBreakCard.jsx'
import SessionBadgesCard from '../components/home/SessionBadgesCard.jsx'
import TodayPlanCard from '../components/home/TodayPlanCard.jsx'

const mapLabels = [
  { icon: Leaf, text: 'Flagstaff Gardens', className: 'pin-flagstaff' },
  { icon: Leaf, text: 'Docklands Park', className: 'pin-docklands' },
  { icon: Building2, text: 'State Library Victoria', className: 'pin-library' },
  { icon: Landmark, text: 'Federation Square', className: 'pin-fed' },
  { icon: Building2, text: 'Queen Victoria Market', className: 'pin-market' },
]

function Home() {
  return (
    <section className="home-dashboard">
      <div className="dashboard-main">
        <div className="break-column">
          <section className="break-card">
            <BreakHero />
          </section>
          <RecommendedMissionCard />
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

          <Link className="mock-map" to="/explore" aria-label="Open Explore Map">
            <div className="map-roads road-a"></div>
            <div className="map-roads road-b"></div>
            <div className="map-roads road-c"></div>
            <div className="map-river"></div>
            <div className="map-zone zone-15"></div>
            <div className="map-zone zone-10"></div>
            <div className="map-zone zone-5"></div>
            <div className="center-person">
              <Footprints size={26} />
            </div>
            {mapLabels.map((label) => (
              <span className={`map-place ${label.className}`} key={label.text}>
                <label.icon size={17} />
                {label.text}
              </span>
            ))}
          </Link>
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
