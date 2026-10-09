import {
  CheckCircle2,
  Database,
  ExternalLink,
  LocateFixed,
  Server,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'

const privacyFacts = [
  'No account required',
  'No advertising trackers',
  'No saved location history',
]

function Privacy() {
  return (
    <section className="page privacy-page">
      <header className="privacy-hero">
        <span className="privacy-kicker">
          <ShieldCheck size={16} aria-hidden="true" />
          Privacy and transparency
        </span>
        <h1>Your privacy, in plain language.</h1>
        <p>
          MoveBreak is a university project that helps people find short indoor and outdoor
          movement breaks. This page explains how the current prototype handles information.
        </p>

        <ul className="privacy-facts" aria-label="Privacy summary">
          {privacyFacts.map((fact) => (
            <li key={fact}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {fact}
            </li>
          ))}
        </ul>
      </header>

      <div className="privacy-card-grid">
        <Card className="privacy-card">
          <span className="privacy-card-icon">
            <LocateFixed size={22} aria-hidden="true" />
          </span>
          <h2>Location information</h2>
          <p>
            MoveBreak asks for your location only when you select <strong>Use my location</strong>
            on the map. Your browser controls the permission request. The assistant also lets you choose a public starting point.
          </p>
          <p>
            If you allow access, coordinates are used to centre the map and sent to the MoveBreak API for location and route estimates. The assistant sends selected starting points to our API for deterministic route calculations, not to the language model.
            MoveBreak does not save those coordinates in localStorage or create a location-history record in its database.
          </p>
        </Card>

        <Card className="privacy-card">
          <span className="privacy-card-icon">
            <Database size={22} aria-hidden="true" />
          </span>
          <h2>Your choices and plans</h2>
          <p>
            Break duration, movement preferences and planner changes are used to update the
            interface. Recommendation preferences and planner items are saved in this browser’s
            localStorage and survive a reload. They do not synchronise across devices and can be
            removed by clearing browser data. Clear plan removes saved planner items. Existing plan
            times are sent to our API when checking AI suggestions for conflicts, but are not saved
            in the backend.
          </p>
          <p>
            Mission preferences are sent to the MoveBreak API to return a recommendation. The
            current backend processes that request without creating a user profile or database
            record. Saved crowd and place preferences are applied in the browser and are not used
            to retrain the pedestrian-footfall model.
          </p>
        </Card>

        <Card className="privacy-card privacy-card-wide">
          <span className="privacy-card-icon">
            <Server size={22} aria-hidden="true" />
          </span>
          <h2>External services and the AI assistant</h2>
          <p>
            In NVIDIA mode, your messages and recent conversation are sent through the MoveBreak
            backend to NVIDIA for language processing. Avoid including personal or sensitive details.
            AI chat history stays in page memory and clears on reload or when you select Clear chat.
            Mock mode is a deterministic local demo and makes no external AI calls. Recommendations
            use existing activity and location data; all plans need your confirmation.
          </p>
          <p>
            The published frontend is hosted by Vercel, the API is hosted by Render, and map tiles
            are provided by OpenStreetMap. When your browser connects to these services, they may
            receive standard technical information such as your IP address, browser details and
            the requested URL under their own policies.
          </p>
          <p>
            MoveBreak does not currently add advertising cookies or analytics trackers to the
            application.
          </p>
          <p>
            Where model assets are available, nearby-place rankings may include historical,
            model-informed pedestrian activity. This is not a live crowd measurement. If the
            assets are unavailable, recommendations continue using neutral pedestrian activity.
          </p>
        </Card>
      </div>

      <Card className="privacy-sources-card">
        <div>
          <span className="privacy-kicker">Map and activity sources</span>
          <h2>Where the information comes from</h2>
          <p>
            Activity guidance and Melbourne place records are supplied as project data through the
            MoveBreak API. Place information is attributed to City of Melbourne Open Data, while
            the interactive base map uses OpenStreetMap tiles and contributor data.
          </p>
        </div>

        <div className="privacy-source-links">
          <a href="https://data.melbourne.vic.gov.au/" rel="noreferrer" target="_blank">
            City of Melbourne Open Data
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
            OpenStreetMap attribution
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </Card>

      <div className="privacy-choice-note">
        <h2>Your choices</h2>
        <p>
          You can decline location access and continue using Melbourne CBD as the default map
          area. You can also clear or change site permissions at any time in your browser settings.
        </p>
      </div>

      <p className="privacy-updated">Last updated: 8 October 2026</p>
    </section>
  )
}

export default Privacy
