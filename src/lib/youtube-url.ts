const ID = /^[\w-]{11}$/
const URL_PAT = /(?:v=|vi=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/
export function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim()
  if (ID.test(s)) return s
  const m = s.match(URL_PAT)
  return m ? m[1] : null
}
