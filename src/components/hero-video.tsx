"use client"

import { useRef, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    const video = videoRef.current
    if (!video) return
    video.muted = !next
    if (next) {
      void video.play()
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
        preload="metadata"
        poster="/videos/tubemine-hero-poster.png"
        aria-label="TubeMine product demo video"
      >
        <source src="/videos/tubemine-hero-demo.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        className="hero-video-sound"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? "Mute video" : "Turn on video sound"}
        title={soundOn ? "Mute video" : "Turn on sound"}
      >
        {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      </button>
    </div>
  )
}
