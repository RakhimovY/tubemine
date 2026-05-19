// Top-N emoji counter for comment sets. Pure. Mirrors Top Words architecture:
// a pure function in lib/, a thin client component in components/.

export type EmojiCount = {
  emoji: string
  count: number
  share: number   // 0..1
}

// Match Extended_Pictographic characters AND their full ZWJ / VS16 / skin-tone
// modifier sequences. Order matters: try the full sequence first, then a
// single pictographic codepoint. The unicode flag is mandatory for the
// \p{...} escapes to work.
const EMOJI_SEQUENCE =
  /\p{Extended_Pictographic}(\p{Emoji_Modifier}|️|(‍\p{Extended_Pictographic})+)*/gu

const NAME_HINTS: Readonly<Record<string, string>> = {
  "❤️": "red heart",
  "🔥": "fire",
  "😂": "face with tears of joy",
  "😍": "smiling face with heart-eyes",
  "🥰": "smiling face with hearts",
  "😊": "smiling face with smiling eyes",
  "👍": "thumbs up",
  "👎": "thumbs down",
  "🙏": "folded hands",
  "💯": "hundred points",
  "🎉": "party popper",
  "✨": "sparkles",
  "💀": "skull",
  "🤣": "rolling on the floor laughing",
  "👏": "clapping hands",
  "🤔": "thinking face",
  "😭": "loudly crying face",
  "😎": "smiling face with sunglasses",
  "🥺": "pleading face",
  "💪": "flexed biceps",
  "🤯": "exploding head",
  "🙄": "face with rolling eyes",
  "😅": "grinning face with sweat",
  "🤩": "star-struck",
  "🎶": "musical notes",
  "🎵": "musical note",
  "❤": "heart",
  "💔": "broken heart",
  "💖": "sparkling heart",
  "💜": "purple heart",
  "💙": "blue heart",
  "💚": "green heart",
  "💛": "yellow heart",
  "🩷": "pink heart",
  "🤍": "white heart",
  "🖤": "black heart",
  "🤬": "face with symbols on mouth",
  "🤡": "clown face",
  "🤝": "handshake",
  "✊": "raised fist",
  "👀": "eyes",
  "🤷": "person shrugging",
  "🤦": "person facepalming",
}

export function emojiName(emoji: string): string {
  return NAME_HINTS[emoji] ?? "emoji"
}

export type TopEmojisAnalysis = {
  items: EmojiCount[]
  totalUnique: number
}

export function analyzeTopEmojis(
  texts: Iterable<string>,
  limit: number = 10,
): TopEmojisAnalysis {
  const counts = new Map<string, number>()
  let total = 0

  for (const raw of texts) {
    if (!raw) continue
    EMOJI_SEQUENCE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = EMOJI_SEQUENCE.exec(raw)) !== null) {
      const e = m[0]
      counts.set(e, (counts.get(e) ?? 0) + 1)
      total++
    }
  }

  if (total === 0) return { items: [], totalUnique: 0 }

  const ranked = Array.from(counts.entries())
    .map(([emoji, count]) => ({ emoji, count, share: count / total }))
    .sort((a, b) => b.count - a.count)

  const items =
    Number.isFinite(limit) && limit < ranked.length ? ranked.slice(0, limit) : ranked

  return { items, totalUnique: counts.size }
}

export function topEmojisFromComments(
  texts: Iterable<string>,
  limit: number = 10,
): EmojiCount[] {
  return analyzeTopEmojis(texts, limit).items
}
