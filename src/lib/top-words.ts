// Stopwords for top-words analytics. English + a handful of high-frequency
// Russian/Spanish stems so multilingual comment sets do not surface "и", "y", etc.
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "could", "did", "didn", "do",
  "does", "doesn", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "hadn", "has", "hasn", "have", "haven", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i",
  "if", "im", "in", "into", "is", "isn", "it", "its", "itself", "just", "ll",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
  "on", "once", "one", "only", "or", "other", "ought", "our", "ours",
  "ourselves", "out", "over", "own", "re", "same", "shan", "she", "should",
  "shouldn", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "to", "too", "under", "until", "up", "us", "use", "very", "was",
  "wasn", "we", "were", "weren", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "won", "would", "wouldn", "you",
  "your", "yours", "yourself", "yourselves",
  // Russian high-frequency
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то",
  "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за",
  "бы", "по", "только", "ее", "мне", "было", "вот", "от", "меня", "еще", "нет",
  "о", "из", "ему", "теперь", "когда", "даже", "ну", "вдруг", "ли", "если",
  "уже", "или", "ни", "быть", "был", "него", "до", "вас", "уж", "вам", "ведь",
  "там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где", "есть",
  "надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб",
  "без", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда", "кто",
  "этот", "того", "потому", "этого", "какой", "ним", "здесь", "этом", "один",
  "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем",
  "всех", "никогда", "можно", "при", "наконец", "два", "об", "другой", "хоть",
  "после", "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них",
  "какая", "много", "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою",
  "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им",
  "более", "всегда", "конечно", "всю", "между", "это", "эта", "очень", "там",
  "просто",
  // Spanish high-frequency
  "el", "la", "los", "las", "y", "o", "que", "de", "del", "a", "al", "en",
  "un", "una", "es", "son", "se", "no", "por", "para", "con", "como", "más",
  "este", "esta", "pero", "lo", "le", "yo", "tu", "su", "mi",
  // Generic markers
  "https", "http", "www", "com", "youtube", "youtu", "https://", "amp",
])

const MIN_WORD_LEN = 3
const MAX_WORD_LEN = 24

export type WordCount = { word: string; count: number }

export type TopWordsAnalysis = {
  items: WordCount[]
  totalUnique: number
}

export function analyzeTopWords(
  texts: Iterable<string>,
  limit: number = 20,
): TopWordsAnalysis {
  const counts = new Map<string, number>()

  for (const raw of texts) {
    if (!raw) continue
    const cleaned = raw
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[@#]\S+/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .toLowerCase()

    for (const word of cleaned.split(/[^\p{L}\p{N}']+/u)) {
      const w = word.trim().replace(/^'+|'+$/g, "")
      if (w.length < MIN_WORD_LEN || w.length > MAX_WORD_LEN) continue
      if (STOPWORDS.has(w)) continue
      if (/^\d+$/.test(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }

  const ranked = Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))

  const items =
    Number.isFinite(limit) && limit < ranked.length ? ranked.slice(0, limit) : ranked

  return { items, totalUnique: counts.size }
}

export function topWordsFromComments(
  texts: Iterable<string>,
  limit: number = 20,
): WordCount[] {
  return analyzeTopWords(texts, limit).items
}
