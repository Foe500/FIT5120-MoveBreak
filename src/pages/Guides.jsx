import { Armchair, BookOpen, ChevronRight, Eye, Footprints, Monitor, Trees } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { guides } from '@/data/guides'
import './Guides.css'

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
          Everyday wellbeing
        </span>
        <h1 id="guides-title">Wellbeing guides</h1>
        <p>Explore five areas of wellbeing, at your desk and beyond.</p>
      </header>

      <ul className="guide-category-grid" aria-label="Wellbeing guide categories">
        {guides.map((category) => {
          const Icon = guideIcons[category.id]

          return (
            <li key={category.id}>
              <Link className="guide-category-link" to={`/guides/${category.id}`}>
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
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default Guides
