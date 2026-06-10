import { Composition, registerRoot } from "remotion"
import { TubeMineHeroVideo } from "./tubemine-hero-video"

const FPS = 30
const DURATION_SECONDS = 42

function RemotionRoot() {
  return (
    <>
      <Composition
        id="tubemine-hero"
        component={TubeMineHeroVideo}
        durationInFrames={DURATION_SECONDS * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ locale: "en" }}
      />
      <Composition
        id="tubemine-hero-ru"
        component={TubeMineHeroVideo}
        durationInFrames={DURATION_SECONDS * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ locale: "ru" }}
      />
    </>
  )
}

registerRoot(RemotionRoot)
