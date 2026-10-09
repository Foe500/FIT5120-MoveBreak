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
import AnimatedStretch from '../components/home/AnimatedStretch.jsx'
import AnimatedContent from '../components/react-bits/AnimatedContent.jsx'
import SoftAurora from '../components/react-bits/SoftAurora.jsx'

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
        <div className="home-soft-aurora" aria-hidden="true">
          <SoftAurora
            bandHeight={0.56}
            bandSpread={0.72}
            brightness={0.68}
            color1="#8fb99a"
            color2="#f5aa98"
            colorSpeed={0.3}
            enableMouseInteraction={false}
            lightMode
            noiseAmplitude={0.55}
            scrollInfluence={0.24}
            speed={0.16}
          />
        </div>

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
          <AnimatedStretch />
          <div className="hero-benefit-card">
            <CheckCircle2 size={20} />
            <div>
              <strong>Short, guided and achievable</strong>
              <span>2–15 minute resets for busy work days</span>
            </div>
          </div>
        </div>
      </section>

      <AnimatedContent className="home-motion-section" distance={24} duration={0.6} threshold={0.16}>
        <section className="how-it-works" aria-labelledby="how-it-works-title">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">How it works</span>
              <h2 id="how-it-works-title">Your reset in three simple steps</h2>
            </div>
          </div>

          <div className="journey-step-grid">
            <AnimatedContent className="motion-card-shell" delay={0.02} distance={18} duration={0.5} threshold={0.18}>
              <article className="journey-step journey-step-sage">
                <span className="step-number">1</span>
                <Smile size={28} aria-hidden="true" />
                <h3>Choose how you feel</h3>
                <p>Tell us your available time, space and what your body needs.</p>
              </article>
            </AnimatedContent>
            <AnimatedContent className="motion-card-shell" delay={0.1} distance={18} duration={0.5} threshold={0.18}>
              <article className="journey-step journey-step-blue">
                <span className="step-number">2</span>
                <TimerReset size={28} aria-hidden="true" />
                <h3>Follow a short break</h3>
                <p>Get a guided indoor activity or a nearby outdoor reset.</p>
              </article>
            </AnimatedContent>
            <AnimatedContent className="motion-card-shell" delay={0.18} distance={18} duration={0.5} threshold={0.18}>
              <article className="journey-step journey-step-coral">
                <span className="step-number">3</span>
                <Sparkles size={28} aria-hidden="true" />
                <h3>Return refreshed</h3>
                <p>Come back re-energised and ready to focus on what matters.</p>
              </article>
            </AnimatedContent>
          </div>
        </section>
      </AnimatedContent>

      <div className="dashboard-bottom">
        <AnimatedContent className="motion-card-shell" distance={20} duration={0.55} threshold={0.14}>
          <TodayPlanCard />
        </AnimatedContent>
        <AnimatedContent className="motion-card-shell" delay={0.08} distance={20} duration={0.55} threshold={0.14}>
          <SessionBadgesCard />
        </AnimatedContent>
        <AnimatedContent className="motion-card-shell" delay={0.16} distance={20} duration={0.55} threshold={0.14}>
          <QuickIndoorBreakCard />
        </AnimatedContent>
      </div>

      <AnimatedContent className="home-motion-section" distance={18} duration={0.5} threshold={0.16}>
        <aside className="bottom-callout">
          <HeartPulse size={18} />
          <strong>Small breaks. Big difference.</strong>
          <span>Short breaks improve focus, wellbeing and bring more energy to your day.</span>
        </aside>
      </AnimatedContent>
    </section>
  )
}

export default Home
