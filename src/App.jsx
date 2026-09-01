import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { CalendarDays, HomeIcon, MapPinned, Sprout, Sparkles, StretchHorizontal } from 'lucide-react'
import './App.css'
import Home from './pages/Home.jsx'
import Mission from './pages/Mission.jsx'
import ExploreMap from './pages/ExploreMap.jsx'
import ActivityLibrary from './pages/ActivityLibrary.jsx'
import ActivityDetail from './pages/ActivityDetail.jsx'
import IndoorGuidedBreak from './pages/IndoorGuidedBreak.jsx'
import Planner from './pages/Planner.jsx'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/mission', label: 'Mission', icon: Sparkles },
  { to: '/explore', label: 'Explore Map', icon: MapPinned },
  { to: '/activities', label: 'Activities', icon: StretchHorizontal },
  { to: '/planner', label: 'Break Planner', icon: CalendarDays },
]

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="MoveBreak Melbourne home">
          <span className="brand-mark">
            <Sprout size={24} strokeWidth={2.4} />
          </span>
          <span>
            <strong>MoveBreak</strong>
            <small>Melbourne</small>
          </span>
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

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mission" element={<Mission />} />
          <Route path="/explore" element={<ExploreMap />} />
          <Route path="/activities" element={<ActivityLibrary />} />
          <Route path="/activities/:activityId" element={<ActivityDetail />} />
          <Route path="/guided/indoor/:activityId" element={<IndoorGuidedBreak />} />
          <Route path="/planner" element={<Planner />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
