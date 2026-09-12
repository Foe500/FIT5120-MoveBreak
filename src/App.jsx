import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Armchair,
  CalendarDays,
  Footprints,
  HomeIcon,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Sprout,
  StretchHorizontal,
  Trophy,
} from 'lucide-react'
import './App.css'
import Home from './pages/Home.jsx'
import Mission from './pages/Mission.jsx'
import ExploreMap from './pages/ExploreMap.jsx'
import ActivityLibrary from './pages/ActivityLibrary.jsx'
import ActivityDetail from './pages/ActivityDetail.jsx'
import IndoorGuidedBreak from './pages/IndoorGuidedBreak.jsx'
import IndoorGuidedSession from './pages/IndoorGuidedSession.jsx'
import OutdoorGuidedBreak from './pages/OutdoorGuidedBreak.jsx'
import Team from './pages/Team.jsx'
import Planner from './pages/Planner.jsx'
import Privacy from './pages/Privacy.jsx'
import { getStoredIndoorBreak } from './lib/indoorBreak'
import { getStoredOutdoorBreak } from './lib/outdoorBreak'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/mission', label: 'Find a break', icon: Sparkles },
  { to: '/explore', label: 'Find a place', icon: MapPinned },
  { to: '/activities', label: 'Activities', icon: StretchHorizontal },
  { to: '/team', label: 'Team', icon: Trophy },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
]

function getOutdoorBreakStatus(session) {
  const breakPlan = session?.breakPlan

  if (!breakPlan) {
    return ''
  }

  const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000)
  const returnAtSeconds = (breakPlan.walkThereMinutes + breakPlan.restMinutes) * 60
  const remainingToReturn = Math.max(0, returnAtSeconds - elapsedSeconds)

  if (remainingToReturn === 0) {
    return 'Time to head back'
  }

  const minutes = Math.ceil(remainingToReturn / 60)

  return `Return reminder in ${minutes} min`
}

function ActiveOutdoorBreakBanner() {
  const location = useLocation()
  const [activeSession, setActiveSession] = useState(() => getStoredOutdoorBreak())

  useEffect(() => {
    function refreshActiveSession() {
      setActiveSession(getStoredOutdoorBreak())
    }

    window.addEventListener('movebreak:outdoor-break-change', refreshActiveSession)
    window.addEventListener('storage', refreshActiveSession)

    return () => {
      window.removeEventListener('movebreak:outdoor-break-change', refreshActiveSession)
      window.removeEventListener('storage', refreshActiveSession)
    }
  }, [])

  if (!activeSession?.breakPlan || location.pathname === '/guided/outdoor') {
    return null
  }

  return (
    <div className="active-break-banner">
      <div>
        <Footprints size={17} />
        <span>
          Outdoor break in progress · <strong>{activeSession.breakPlan.placeName}</strong>
        </span>
      </div>
      <span>{getOutdoorBreakStatus(activeSession)}</span>
      <Link to="/guided/outdoor">Resume timer</Link>
    </div>
  )
}

function ActiveIndoorBreakBanner() {
  const location = useLocation()
  const [activeSession, setActiveSession] = useState(() => getStoredIndoorBreak())

  useEffect(() => {
    function refreshActiveSession() {
      setActiveSession(getStoredIndoorBreak())
    }

    window.addEventListener('movebreak:indoor-break-change', refreshActiveSession)
    window.addEventListener('storage', refreshActiveSession)

    return () => {
      window.removeEventListener('movebreak:indoor-break-change', refreshActiveSession)
      window.removeEventListener('storage', refreshActiveSession)
    }
  }, [])

  if (!activeSession?.path || location.pathname.startsWith('/guided/indoor')) {
    return null
  }

  return (
    <div className="active-break-banner indoor">
      <div>
        <Armchair size={17} />
        <span>
          {activeSession.type} in progress · <strong>{activeSession.label}</strong>
        </span>
      </div>
      <span>Timer ready to resume</span>
      <Link to={activeSession.path}>Resume timer</Link>
    </div>
  )
}

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="MoveBreak Melbourne home">
          <span className="brand-mark">
            <Sprout size={24} strokeWidth={2.4} />
          </span>
          <strong>MoveBreak</strong>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink key={item.to} to={item.to}>
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </header>

      <ActiveIndoorBreakBanner />
      <ActiveOutdoorBreakBanner />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mission" element={<Mission />} />
          <Route path="/explore" element={<ExploreMap />} />
          <Route path="/activities" element={<ActivityLibrary />} />
          <Route path="/activities/:activityId" element={<ActivityDetail />} />
          <Route path="/guided/indoor/:activityId" element={<IndoorGuidedBreak />} />
          <Route path="/guided/indoor-session" element={<IndoorGuidedSession />} />
          <Route path="/guided/outdoor" element={<OutdoorGuidedBreak />} />
          <Route path="/team" element={<Team />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>

      <footer className="footer" aria-label="Site information">
        <div className="footer-content">
          <Link className="footer-brand" to="/" aria-label="MoveBreak home">
            <span className="footer-brand-mark" aria-hidden="true">
              <Sprout size={18} strokeWidth={2.3} />
            </span>
            <span>© 2026 MoveBreak</span>
          </Link>
          <nav className="footer-links" aria-label="Footer navigation">
            <NavLink to="/privacy">
              <ShieldCheck size={15} aria-hidden="true" />
              Privacy
            </NavLink>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default App
