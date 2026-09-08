import { useState } from 'react'
import {
  CheckCircle2,
  HeartPulse,
  Smile,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import BreakHero from '../components/BreakHero.jsx'
import QuickIndoorBreakCard from '../components/home/QuickIndoorBreakCard.jsx'
import SessionBadgesCard from '../components/home/SessionBadgesCard.jsx'
import TodayPlanCard from '../components/home/TodayPlanCard.jsx'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

function Home() {
  // Keep duration unselected until Emily actively chooses 5, 10 or 15 minutes.
  const [selectedDuration, setSelectedDuration] = useState(null)
  const [durationError, setDurationError] = useState('')

  function handleDurationChange(duration) {
    setSelectedDuration(duration)
    setDurationError('')
  }

  function handleMissingDuration() {
    // BreakHero owns the button click, but Home owns the validation message state.
    setDurationError('Choose how much time you have before finding your break.')
  }

  return (
    <section className="home-dashboard home-redesign">
      <section className="home-hero-shell">
        <div className="home-hero-copy">
          <span className="home-eyebrow">
            <Sparkles size={15} />
            A small pause for a better work day
          </span>
          <BreakHero
            durationError={durationError}
            onMissingDuration={handleMissingDuration}
            selectedDuration={selectedDuration}
            onDurationChange={handleDurationChange}
          />
        </div>

        <div className="home-hero-visual" aria-label="A person taking a movement break beside a work desk">
          <span className="hero-shape hero-shape-blue" aria-hidden="true"></span>
          <span className="hero-shape hero-shape-green" aria-hidden="true"></span>
          <img src={shoulderReleaseImage} alt="Person stretching beside a work desk" />
          <div className="hero-benefit-card">
            <CheckCircle2 size={20} />
            <div>
              <strong>Short, guided and achievable</strong>
              <span>2–15 minute resets for busy work days</span>
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

      <div className="dashboard-bottom">
        <TodayPlanCard />
        <SessionBadgesCard />
        <QuickIndoorBreakCard />
      </div>

      <aside className="bottom-callout">
        <HeartPulse size={18} />
        <strong>Small breaks. Big difference.</strong>
        <span>Short breaks improve focus, wellbeing and bring more energy to your day.</span>
      </aside>
    </section>
  )
}

export default Home
