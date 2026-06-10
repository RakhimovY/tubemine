"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

const SOUND_STORAGE_KEY = "tubemine.heroVideo.sound"

type HeroVideoProps = {
  locale: string
}

export function HeroVideo({ locale }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const isRu = locale === "ru"
  const labels = isRu
    ? {
        aria: "Демо-видео TubeMine",
        mute: "Выключить звук видео",
        unmute: "Включить звук видео",
        turnOnTitle: "Включить звук",
      }
    : {
        aria: "TubeMine product demo video",
        mute: "Mute video",
        unmute: "Turn on video sound",
        turnOnTitle: "Turn on sound",
      }
  const videoSrc = isRu
    ? "/videos/tubemine-hero-demo-ru.mp4"
    : "/videos/tubemine-hero-demo.mp4"
  const posterSrc = isRu
    ? "/videos/tubemine-hero-poster-ru.png"
    : "/videos/tubemine-hero-poster.png"

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playsInline = true

    const preferredSound = localStorage.getItem(SOUND_STORAGE_KEY) === "on"
    setSoundOn(preferredSound)
    video.muted = !preferredSound

    const playWithPreference = async () => {
      try {
        await video.play()
        setSoundOn(!video.muted)
      } catch {
        video.muted = true
        setSoundOn(false)
        void video.play().catch(() => undefined)
      }
    }

    void playWithPreference()
    video.addEventListener("loadeddata", playWithPreference)
    video.addEventListener("canplay", playWithPreference)
    return () => {
      video.removeEventListener("loadeddata", playWithPreference)
      video.removeEventListener("canplay", playWithPreference)
    }
  }, [videoSrc])

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off")
    const video = videoRef.current
    if (!video) return
    video.muted = !next
    if (next) {
      void video.play().catch(() => {
        video.muted = true
        setSoundOn(false)
      })
    }
  }

  return (
    <div className="hero-video-frame">
      <video
        ref={videoRef}
        className="hero-video"
        autoPlay
        loop
        muted={!soundOn}
        playsInline
        preload="auto"
        poster={posterSrc}
        aria-label={labels.aria}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      <button
        type="button"
        className="hero-video-sound"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? labels.mute : labels.unmute}
        title={soundOn ? labels.mute : labels.turnOnTitle}
      >
        {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      </button>
    </div>
  )
}
