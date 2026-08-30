import { useState } from 'react'
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

const movementOptions = [
  {
    label: 'Indoor',
    description: 'Guided activities you can do at your desk',
    image: shoulderReleaseImage,
    imageAlt: 'Person stretching beside a desk',
  },
  {
    label: 'Outdoor',
    description: 'Nearby walks and outdoor resets',
    image: greenSpaceImage,
    imageAlt: 'Tree-lined walking path beside Melbourne city',
  },
]

const needOptions = [
  { icon: Eye, label: 'Eyes tired' },
  { icon: Armchair, label: 'Stiff shoulders' },
  { icon: Zap, label: 'Low energy' },
  { icon: Leaf, label: 'Feeling stressed' },
  { icon: Footprints, label: 'General movement' },
]

function Mission() {
  const [duration, setDuration] = useState(10)
  const [movementType, setMovementType] = useState('Outdoor')
  const [need, setNeed] = useState('Low energy')

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
                    className={option === duration ? 'selected' : ''}
                    key={option}
                    onClick={() => setDuration(option)}
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
                {movementOptions.map((option) => (
                  <button
                    className={option.label === movementType ? 'movement-card selected' : 'movement-card'}
                    key={option.label}
                    onClick={() => setMovementType(option.label)}
                    type="button"
                  >
                    <img src={option.image} alt={option.imageAlt} />
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
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
                      className={option.label === need ? 'selected' : ''}
                      key={option.label}
                      onClick={() => setNeed(option.label)}
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
              <Badge variant="success">{movementType}</Badge>
              <Badge variant="secondary">
                <Clock3 size={13} />
                {duration} min
              </Badge>
              <Badge variant="secondary">
                <BatteryCharging size={13} />
                {need}
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
            <Button
              className="preview-secondary-button"
              onClick={() => setMovementType(movementType === 'Indoor' ? 'Outdoor' : 'Indoor')}
              variant="outline"
              type="button"
            >
              <Armchair size={17} />
              Try {movementType === 'Indoor' ? 'outdoor' : 'indoor'} instead
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
