import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public", "videos")
const textPath = join(outDir, "tubemine-hero-voiceover.txt")
const aiffPath = join(outDir, "tubemine-hero-voiceover.aiff")
const mp3Path = join(outDir, "tubemine-hero-voiceover.mp3")

const script = [
  "TubeMine brings YouTube comments into the AI tools you already use.",
  "Paste a video link into Claude, ChatGPT, Cursor, or Codex.",
  "TubeMine pulls the full comment thread through MCP.",
  "Your assistant sees sentiment, top words, emoji, and the comments behind the signal.",
  "Use the web dashboard when you need saved history, quota tracking, and clean exports.",
].join(" ")

mkdirSync(outDir, { recursive: true })
writeFileSync(textPath, `${script}\n`)

execFileSync("say", ["-v", "Samantha", "-r", "174", "-o", aiffPath, script], {
  stdio: "inherit",
})
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    aiffPath,
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "3",
    mp3Path,
  ],
  { stdio: "inherit" },
)
rmSync(aiffPath, { force: true })

console.log(`Wrote ${mp3Path}`)
