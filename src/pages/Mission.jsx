import { Link } from 'react-router-dom'
import {
  Armchair,
  BatteryCharging,
  Clock3,
  Eye,
  Footprints,
  Leaf,
  Map,
  MapPin,
  Shuffle,
  TimerReset,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import greenSpaceImage from '@/assets/home/green-space-reset.jpg'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

const durationOptions = [5, 10, 15]

const needOptions = [
  { icon: Eye, label: 'Eyes tired' },
  { icon: Armchair, label: 'Stiff shoulders' },
  { icon: Zap, label: 'Low energy', selected: true },
  { icon: Leaf, label: 'Feeling stressed' },
  { icon: Footprints, label: 'General movement' },
]

function Mission() {
  return (
    <section className="page mission-page">
      <div className="mission-shell">
        <div className="mission-builder">
          <div className="mission-heading">
            <h1>Find the right break</h1>
            <p>Choose what fits your time, space and energy right now.</p>
          </div>

          <Card className="mission-builder-card">
            <div className="builder-section">
              <div className="builder-question">
                <span>1</span>
                <h2>How much time do you have?</h2>
              </div>
              <div className="mission-duration-tabs" aria-label="Choose break duration">
                {durationOptions.map((option) => (
                  <button
                    className={option === 10 ? 'selected' : ''}
                    key={option}
                    type="button"
                  >
                    {option} min
                  </button>
                ))}
              </div>
            </div>

            <div className="builder-section">
              <div className="builder-question">
                <span>2</span>
                <h2>Where would you like to move?</h2>
              </div>

              <div className="movement-choice-grid">
                <button className="movement-card" type="button">
                  <img
                    src={shoulderReleaseImage}
                    alt="Person stretching beside a desk"
                  />
                  <strong>Indoor</strong>
                  <small>Guided activities you can do at your desk</small>
                </button>

                <button className="movement-card selected" type="button">
                  <img
                    src={greenSpaceImage}
                    alt="Tree-lined walking path beside Melbourne city"
                  />
                  <strong>Outdoor</strong>
                  <small>Nearby walks and outdoor resets</small>
                </button>
              </div>

              <Button className="surprise-button" size="sm" variant="outline" type="button">
                <Shuffle size={15} />
                Surprise me
              </Button>
            </div>

            <div className="builder-section">
              <div className="builder-question">
                <span>3</span>
                <h2>What do you need?</h2>
              </div>

              <div className="need-chip-row">
                {needOptions.map((option) => {
                  const Icon = option.icon

                  return (
                    <button
                      className={option.selected ? 'selected' : ''}
                      key={option.label}
                      type="button"
                    >
                      <Icon size={15} />
                      {option.label}
                    </button>
                  )
                })}
              </div>

              <Button className="show-options-button" type="button">
                <Footprints size={17} />
                Show my options
              </Button>
            </div>
          </Card>
        </div>

        <Card className="mission-preview-card">
          <div className="title-with-icon">
            <MapPin size={18} />
            <h2>Your mission preview</h2>
          </div>

          <div className="preview-panel">
            <h3>Flagstaff Fresh-Air Loop</h3>
            <div className="preview-tags">
              <Badge variant="success">Outdoor</Badge>
              <Badge variant="secondary">
                <Clock3 size={13} />
                10 min
              </Badge>
              <Badge variant="secondary">
                <BatteryCharging size={13} />
                Low energy
              </Badge>
            </div>

            <div className="preview-map" aria-label="Route preview map">
              <div className="preview-grid"></div>
              <div className="preview-park"></div>
              <div className="route-line"></div>
              <span className="route-user">You</span>
              <span className="route-destination">Flagstaff Gardens</span>
            </div>

            <div className="route-breakdown">
              <span>
                <Footprints size={16} />
                <strong>Walk out</strong>
                4 min
              </span>
              <span>
                <Leaf size={16} />
                <strong>Reset</strong>
                2 min
              </span>
              <span>
                <Footprints size={16} />
                <strong>Walk back</strong>
                4 min
              </span>
            </div>

            <Button asChild className="preview-primary-button">
              <Link to="/explore">
                <Map size={17} />
                Open in Explore Map
              </Link>
            </Button>
            <Button className="preview-secondary-button" variant="outline" type="button">
              <Armchair size={17} />
              Try indoor instead
            </Button>

            <p className="return-note">
              <TimerReset size={15} />
              Includes time to return.
            </p>
          </div>
        </Card>
      </div>
    </section>
  )
}

export default Mission
