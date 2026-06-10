import { Composition, registerRoot } from "remotion"
import { TubeMineHeroVideo } from "./tubemine-hero-video"

const FPS = 30
const DURATION_SECONDS = 30

function RemotionRoot() {
  return (
    <Composition
      id="tubemine-hero"
      component={TubeMineHeroVideo}
      durationInFrames={DURATION_SECONDS * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  )
}

registerRoot(RemotionRoot)
