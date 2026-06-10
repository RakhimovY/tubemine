import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "public", "videos")
const voiceovers = [
  {
    locale: "en",
    output: "tubemine-hero-voiceover.mp3",
    script: "tubemine-hero-voiceover.txt",
    input: [
      "Your next video idea is already sitting in the comments.",
      "Connect TubeMine to the AI assistant you already use, then ask for the comments on any public YouTube video.",
      "TubeMine calls one MCP tool, get_youtube_comments, and returns the raw thread: author, text, likes, replies, and timestamps.",
      "From there, your model does the thinking. It can find the questions, the complaints, the requests, and the follow-up angle.",
      "When you want a ready report instead, paste the same URL in the TubeMine web app for sentiment, top words, emoji, history, and clean exports.",
      "TubeMine gets the audience signal into your workflow.",
    ].join(" "),
    instructions: [
      "Sound like a calm, confident SaaS product demo narrator.",
      "Natural human pacing, not announcer voice.",
      "Slightly energetic but restrained.",
      "Emphasize MCP tool names clearly.",
      "No exaggerated excitement.",
    ].join(" "),
  },
  {
    locale: "ru",
    output: "tubemine-hero-voiceover-ru.mp3",
    script: "tubemine-hero-voiceover-ru.txt",
    input: [
      "Идея для следующего видео уже в комментариях.",
      "Подключите TubeMine к вашему AI и попросите комментарии к YouTube-видео.",
      "TubeMine вызывает get_youtube_comments и возвращает сырую ветку: автор, текст, лайки, ответы и время.",
      "Дальше модель находит вопросы, жалобы, запросы и идеи для ролика.",
      "Нужен готовый отчет? Та же ссылка в веб-приложении даёт тональность, слова, эмодзи, историю и экспорт.",
      "TubeMine переносит сигнал аудитории в ваш процесс.",
    ].join(" "),
    instructions: [
      "Говори как живой русскоязычный диктор для современного SaaS-демо, с естественной интонацией.",
      "Темп уверенный и немного быстрее среднего, но не скороговорка.",
      "Звучание должно быть человеческим, спокойным и энергичным, без рекламного пафоса.",
      "Термины MCP и get_youtube_comments произноси четко.",
      "Вся озвучка должна звучать завершённо и уложиться примерно в 39 секунд.",
    ].join(" "),
    voices: ["sage", "marin"],
  },
]

mkdirSync(outDir, { recursive: true })

async function generateVoiceover({ input, instructions, output, script, voices }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for production-quality voiceover")
  }

  writeFileSync(join(outDir, script), `${input}\n`)

  const voiceCandidates = voices ?? ["marin"]
  let lastError = ""

  for (const voice of voiceCandidates) {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input,
        instructions,
        response_format: "mp3",
      }),
    })

    if (!response.ok) {
      lastError = `${response.status} ${await response.text()}`
      continue
    }

    const audio = Buffer.from(await response.arrayBuffer())
    writeFileSync(join(outDir, output), audio)
    return
  }

  throw new Error(`OpenAI speech generation failed: ${lastError}`)
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", ...args], { stdio: "inherit" })
}

function generateSoundDesign() {
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=58:duration=42",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=116:duration=42",
    "-filter_complex",
    "[0:a]volume=0.11,lowpass=f=180[a0];[1:a]volume=0.045,lowpass=f=260[a1];[a0][a1]amix=inputs=2,afade=t=in:st=0:d=1.2,afade=t=out:st=40.5:d=1.5",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "5",
    join(outDir, "sfx-bed.mp3"),
  ])

  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "anoisesrc=d=0.65:c=pink:r=48000",
    "-af",
    "bandpass=f=900:width_type=h:w=520,afade=t=in:st=0:d=0.08,afade=t=out:st=0.25:d=0.38,volume=0.55",
    join(outDir, "sfx-whoosh.wav"),
  ])

  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1200:duration=0.045",
    "-af",
    "afade=t=out:st=0.01:d=0.035,volume=0.42",
    join(outDir, "sfx-click.wav"),
  ])

  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=0.54",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1320:duration=0.54",
    "-filter_complex",
    "[0:a]volume=0.32[a0];[1:a]volume=0.18[a1];[a0][a1]amix=inputs=2,afade=t=out:st=0.08:d=0.46",
    join(outDir, "sfx-ding.wav"),
  ])
}

for (const voiceover of voiceovers) {
  await generateVoiceover(voiceover)
}
generateSoundDesign()

console.log(`Wrote voiceover and sound design assets to ${outDir}`)
