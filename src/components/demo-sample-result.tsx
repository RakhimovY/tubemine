"use client"

import { ResultBlock } from "@/components/result-block"
import type { Comment } from "@/lib/types"
import type { WordCount } from "@/lib/top-words"
import type { EmojiCount } from "@/lib/emoji-frequency"

/*
  Static promo block shown to anonymous visitors on the landing demo section as
  an educational preview of what TubeMine analysis output looks like. It renders
  the SAME real <ResultBlock> the dashboard uses, fed mock data at the anonymous
  tier (locked sentiment, top 5 words / emoji, single Save CSV). It must hide as
  soon as the real flow takes over; that gating lives in <TubeMine>.

  Mock strings deliberately include a long video title, a long author handle, and
  a long word to stress-test truncation. No em-dash or en-dash anywhere.
*/

const MOCK_TITLE =
  "How I Actually Edit My YouTube Videos in 2026, My Complete Start to Finish Editing Workflow, Gear, Plugins and Color Grading Setup (Full Uncut Walkthrough)"
const MOCK_CHANNEL = "@PixelForge"

const MOCK_WORDS: WordCount[] = [
  { word: "tutorial", count: 847 },
  { word: "colorgradingworkflow", count: 662 },
  { word: "workflow", count: 543 },
  { word: "helpful", count: 449 },
  { word: "thanks", count: 398 },
]

const MOCK_EMOJI: EmojiCount[] = [
  { emoji: "\u{1F525}", count: 3541, share: 0.182 },
  { emoji: "❤️", count: 2860, share: 0.147 },
  { emoji: "\u{1F44F}", count: 2198, share: 0.113 },
  { emoji: "\u{1F4AF}", count: 1867, share: 0.096 },
  { emoji: "\u{1F60D}", count: 1634, share: 0.084 },
]

const MOCK_COMMENTS: Comment[] = [
  {
    author: "@sarah_makes",
    text: "This is the workflow video I have needed for months. The premiere shortcut at 4:12 alone is worth a sub. Thank you so much, instantly subscribed.",
    likes: 1240,
    replies: 38,
    publishedAt: "2026-05-30T12:00:00.000Z",
    sentiment: "positive",
  },
  {
    author: "@mike.travels",
    text: "Quick question, what mic are you using for the voiceover? It sounds amazing and I have been hunting for an upgrade.",
    likes: 312,
    replies: 5,
    publishedAt: "2026-05-29T12:00:00.000Z",
    sentiment: "neutral",
  },
  {
    author: "@designdaily",
    text: "Love the part about cutting B-roll first. I always do it last and it slows me down so much. Trying this tomorrow.",
    likes: 209,
    replies: 12,
    publishedAt: "2026-05-28T12:00:00.000Z",
    sentiment: "positive",
  },
  {
    author: "@priya.films",
    text: "Way too long. This could have been a 6 minute video honestly, half of it is filler and repeated points.",
    likes: 41,
    replies: 9,
    publishedAt: "2026-05-27T12:00:00.000Z",
    sentiment: "negative",
  },
  {
    author: "@longwinded_larry_the_editor_who_writes_full_essays",
    text: "Okay so I have been editing for about three years now and I picked up at least four things from this that I had never seen before, especially the bit about color matching across clips shot on different cameras, and the section on audio ducking under the voiceover, so thank you for putting this together, it is clearly a lot of work.",
    likes: 17,
    replies: 0,
    publishedAt: "2026-05-25T12:00:00.000Z",
    sentiment: "neutral",
  },
]

const noop = () => {}

export function DemoSampleResult() {
  return (
    <div className="mt-6" aria-live="polite">
      <ResultBlock
        tier="anonymous"
        commentsAnalyzed={19422}
        videoTitle={MOCK_TITLE}
        channel={MOCK_CHANNEL}
        sentiment={null}
        distribution={null}
        topWords={MOCK_WORDS}
        uniqueWordsTotal={1284}
        topEmoji={MOCK_EMOJI}
        uniqueEmojiTotal={142}
        comments={MOCK_COMMENTS}
        onDownloadCsv={noop}
        onDownloadJson={noop}
        onDownloadExcel={noop}
      />
    </div>
  )
}
