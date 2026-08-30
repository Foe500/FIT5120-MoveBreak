import { Link, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home.jsx'
import Mission from './pages/Mission.jsx'
import ExploreMap from './pages/ExploreMap.jsx'
import ActivityLibrary from './pages/ActivityLibrary.jsx'
import Planner from './pages/Planner.jsx'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/mission', label: 'Mission' },
  { to: '/explore', label: 'Explore Map' },
  { to: '/activities', label: 'Activities' },
  { to: '/planner', label: 'Planner' },
]

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="MoveBreak Melbourne home">
          <strong>MoveBreak</strong>
          <span>Melbourne</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mission" element={<Mission />} />
          <Route path="/explore" element={<ExploreMap />} />
          <Route path="/activities" element={<ActivityLibrary />} />
          <Route path="/planner" element={<Planner />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
