import { ArrowLeft, CalendarCheck, ExternalLink, Lightbulb } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { guideById, guideReviewDate } from '@/data/guides'
import './Guides.css'

function GuideDetail() {
  const { guideId } = useParams()
  const guide = guideById[guideId]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [guideId])

  if (!guide) {
    return (
      <section className="page guide-not-found">
        <h1>Guide not found</h1>
        <p>This wellbeing guide is not available.</p>
        <Link className="guide-back-link" to="/guides">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to all guides
        </Link>
      </section>
    )
  }

  return (
    <article className="page guide-detail-page" aria-labelledby="guide-detail-title">
      <Link className="guide-back-link" to="/guides">
        <ArrowLeft size={16} aria-hidden="true" />
        All wellbeing guides
      </Link>

      <header className={`guide-detail-hero guide-detail-hero-${guide.tone}`}>
        <span className="guides-kicker">Wellbeing guide</span>
        <h1 id="guide-detail-title">{guide.title}</h1>
        <p>{guide.introduction}</p>
      </header>

      <div className="guide-detail-layout">
        <div className="guide-detail-main">
          <Card className="guide-scenario-card">
            <span className="guide-detail-icon">
              <Lightbulb size={22} aria-hidden="true" />
            </span>
            <div>
              <span className="guide-section-label">Scenario</span>
              <h2>When this guide can help</h2>
              <p>{guide.scenario}</p>
            </div>
          </Card>

          <section className="guide-content-section" aria-labelledby="guide-content-title">
            <span className="guide-section-label">Main content</span>
            <h2 id="guide-content-title">What you can do</h2>

            <div className="guide-content-list">
              {guide.sections.map((section, index) => (
                <section className="guide-content-item" key={section.title}>
                  <span aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>

        <aside className="guide-detail-sidebar" aria-label="Guide information">
          <Card className="guide-review-card">
            <CalendarCheck size={21} aria-hidden="true" />
            <div>
              <span>Last reviewed</span>
              <time dateTime={guideReviewDate.dateTime}>{guideReviewDate.label}</time>
            </div>
          </Card>

          <Card className="guide-sources-card">
            <span className="guide-section-label">Information sources</span>
            <h2>Learn more</h2>
            <ul>
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noreferrer" target="_blank">
                    <span>
                      <strong>{source.title}</strong>
                      <small>{source.publisher}</small>
                    </span>
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </article>
  )
}

export default GuideDetail
