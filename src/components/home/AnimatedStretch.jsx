import { useId, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import shoulderReleaseImage from '@/assets/home/shoulder-release.png'

// Reuse the original artwork, moving only the upper body around the waist.
const upperBody = 'M308 0H491V210H430L415 281H308Z'

export default function AnimatedStretch() {
  const id = useId()
  const [paused, setPaused] = useState(false)

  return (
    <>
      <svg
        className={`hero-stretch${paused ? ' is-paused' : ''}`}
        viewBox="0 0 600 600"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>Person gently stretching beside a work desk</title>
        <defs>
          <clipPath id={`${id}-body`}>
            <path d={upperBody} />
          </clipPath>
          <clipPath id={`${id}-still`}>
            <path d={`M0 0H600V600H0Z ${upperBody}`} clipRule="evenodd" />
          </clipPath>
        </defs>
        <image href={shoulderReleaseImage} width="600" height="600" clipPath={`url(#${id}-still)`} />
        <g className="hero-stretch-body">
          <image href={shoulderReleaseImage} width="600" height="600" clipPath={`url(#${id}-body)`} />
        </g>
      </svg>
      <button
        className="hero-motion-toggle"
        type="button"
        aria-label={paused ? 'Play illustration animation' : 'Pause illustration animation'}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </>
  )
}
