import { Armchair, BookOpen, ChevronRight, Eye, Footprints, Monitor, Trees } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { guides } from '@/data/guides'
import './Guides.css'
import AnimatedContent from '@/components/react-bits/AnimatedContent'
import BlurText from '@/components/react-bits/BlurText'
import GradientText from '@/components/react-bits/GradientText'
import SpotlightCard from '@/components/react-bits/SpotlightCard'

const guideIcons = {
  eyes: Eye,
  posture: Armchair,
  'desk-setup': Monitor,
  movement: Footprints,
  'outdoor-break': Trees,
}

function Guides() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <section className="page guides-page" aria-labelledby="guides-title">
      <header className="guides-heading">
        <span className="guides-kicker">
          <BookOpen size={17} aria-hidden="true" />
          <GradientText animationSpeed={6} className="guides-kicker-text" colors={['#2f7d5b', '#6aa6c9', '#d98a5f', '#2f7d5b']}>
            Everyday wellbeing
          </GradientText>
        </span>
        <BlurText animateBy="words" as="h1" delay={50} direction="bottom" id="guides-title" stepDuration={0.28} text="Wellbeing guides" />
        <p>Explore five areas of wellbeing, at your desk and beyond.</p>
      </header>

      <ul className="guide-category-grid" aria-label="Wellbeing guide categories">
        {guides.map((category, index) => {
          const Icon = guideIcons[category.id]

          return (
            <li key={category.id}>
              <AnimatedContent className="motion-card-shell" delay={(index % 3) * 0.08} distance={20} duration={0.5} threshold={0.1}>
              <Link className="guide-category-link" to={`/guides/${category.id}`}>
                <SpotlightCard className="guide-spotlight" spotlightColor="rgba(85, 150, 110, 0.22)">
                <Card className="guide-category-card" aria-labelledby={`guide-${category.id}`}>
                  <span className={`guide-category-icon guide-category-icon-${category.tone}`}>
                    <Icon size={27} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <h2 id={`guide-${category.id}`}>{category.title}</h2>
                  <p>{category.description}</p>
                  <span className="guide-card-action">
                    Read guide
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                </Card>
                </SpotlightCard>
              </Link>
              </AnimatedContent>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default Guides
