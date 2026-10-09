import { useCallback, useEffect, useRef, useState } from 'react'
import activityMusicUrl from '@/assets/audio/alex-morgan-tokyo-night-walk-537446.mp3'

const ACTIVITY_MUSIC_VOLUME = 0.22

function resetAudio(audio) {
  audio.pause()
  audio.currentTime = 0
}

export function useActivityMusic() {
  const audioRef = useRef(null)
  const [isMusicEnabled, setIsMusicEnabled] = useState(true)
  const [musicError, setMusicError] = useState('')

  useEffect(() => {
    const audio = new Audio(activityMusicUrl)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = ACTIVITY_MUSIC_VOLUME
    audioRef.current = audio

    return () => {
      resetAudio(audio)
      audioRef.current = null
    }
  }, [])

  const playMusic = useCallback(
    ({ restart = false } = {}) => {
      const audio = audioRef.current

      if (!audio || !isMusicEnabled) {
        return
      }

      if (restart) {
        audio.currentTime = 0
      }

      setMusicError('')
      const playAttempt = audio.play()

      if (playAttempt) {
        playAttempt.catch(() => {
          setMusicError('Music could not start. Use the music button to try again.')
        })
      }
    },
    [isMusicEnabled],
  )

  const pauseMusic = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const resetMusic = useCallback(() => {
    const audio = audioRef.current

    if (audio) {
      resetAudio(audio)
    }
  }, [])

  const toggleMusic = useCallback((shouldPlay) => {
    setIsMusicEnabled((currentlyEnabled) => {
      const nextEnabled = !currentlyEnabled
      const audio = audioRef.current

      setMusicError('')

      if (!audio) {
        return nextEnabled
      }

      if (!nextEnabled) {
        audio.pause()
      } else if (shouldPlay) {
        const playAttempt = audio.play()

        if (playAttempt) {
          playAttempt.catch(() => {
            setMusicError('Music could not start. Use the music button to try again.')
          })
        }
      }

      return nextEnabled
    })
  }, [])

  return {
    isMusicEnabled,
    musicError,
    pauseMusic,
    playMusic,
    resetMusic,
    toggleMusic,
  }
}
