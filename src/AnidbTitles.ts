import fs from 'fs'
import zlib from 'zlib'

/** title types as numbered in the dump, named like the HTTP API `<title type="…">` where one exists */
const TITLE_TYPES = {
  '1': 'main',
  '2': 'synonym',
  '3': 'short',
  '4': 'official',
  '5': 'kana',
  '6': 'card',
} as const

export type AnimeTitleType = typeof TITLE_TYPES[keyof typeof TITLE_TYPES]

export type AnimeTitle = {
  aid: number
  type: AnimeTitleType
  lang: string
  title: string
}

export type AnimeTitleMatch = AnimeTitle & {
  /** main title of the matched anime */
  main_title: string
  /** higher is better, only meaningful for ordering */
  score: number
}

// preferred type when several titles of the same anime (or several anime) match equally well
const TYPE_BONUS: Record<AnimeTitleType, number> = { main: 5, official: 4, synonym: 2, short: 2, card: 1, kana: 0 }

type IndexedTitle = AnimeTitle & { normalized: string, words: string[] }

const strip = ({ aid, type, lang, title }: IndexedTitle): AnimeTitle => ({ aid, type, lang, title })

/**
 * lower case, full-width → ascii, latin diacritics and punctuation removed (`Teräsalkemisti` → `terasalkemisti`, `FMA:B` → `fma b`)
 * @ignore
 */
export function normalizeTitle (title: string): string {
  return title
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Local index of the AniDB [anime titles dump](https://wiki.anidb.net/API#Anime_Titles), for title search and title → aid lookups
 * without spending API requests.
 *
 * The dump has to be downloaded by you: AniDB serves it behind a Cloudflare browser check, and **it must not be requested more than once per day**.
 * Get it from `http://anidb.net/api/anime-titles.dat.gz` and load it with {@link AnidbTitles.fromFile}.
 *
 * @example
 * ```ts
 * const titles = await AnidbTitles.fromFile('./anime-titles.dat.gz')
 * titles.search('fullmetal brotherhood')
 * const http = new AnidbHTTPClient('myhttpclient', 1, { titles })
 * await http.anime('Fullmetal Alchemist: Brotherhood')
 * ```
 */
export class AnidbTitles {
  /** when the dump was generated, from its `# created:` header */
  readonly created: Date | undefined
  private entries: IndexedTitle[]
  private byAid = new Map<number, IndexedTitle[]>()
  private byNormalized = new Map<string, IndexedTitle[]>()

  private constructor (entries: AnimeTitle[], created?: Date) {
    this.created = created
    this.entries = entries.map((e) => {
      const normalized = normalizeTitle(e.title)
      return { ...e, normalized, words: normalized.split(' ') }
    })

    for (const entry of this.entries) {
      push(this.byAid, entry.aid, entry)
      push(this.byNormalized, entry.normalized, entry)
    }
  }

  /** load a `anime-titles.dat` or `anime-titles.dat.gz` file */
  static async fromFile (file: string): Promise<AnidbTitles> {
    return AnidbTitles.fromBuffer(await fs.promises.readFile(file))
  }

  /** parse dump contents, gzipped or not */
  static fromBuffer (data: Buffer | string): AnidbTitles {
    const text = typeof data === 'string'
      ? data
      : (data[0] === 0x1f && data[1] === 0x8b ? zlib.gunzipSync(data) : data).toString('utf8')

    const entries: AnimeTitle[] = []
    let created: Date | undefined

    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith('#')) {
        const match = line.match(/^#\s*created:\s*(.+)$/)
        if (match && !Number.isNaN(Date.parse(match[1]))) {
          created = new Date(match[1])
        }
        continue
      }
      // `<aid>|<type>|<language>|<title>`, titles may contain `|` themselves
      const match = line.match(/^(\d+)\|(\d+)\|([^|]*)\|(.+)$/)
      if (!match) {
        continue
      }
      const type = TITLE_TYPES[match[2] as keyof typeof TITLE_TYPES]
      if (type) {
        entries.push({ aid: Number(match[1]), type, lang: match[3], title: match[4] })
      }
    }

    return new AnidbTitles(entries, created)
  }

  /** number of anime in the index */
  get size (): number {
    return this.byAid.size
  }

  /** all titles of an anime */
  titles (aid: number): AnimeTitle[] {
    return (this.byAid.get(aid) || []).map(strip)
  }

  /** main (romanised) title of an anime */
  mainTitle (aid: number): string | undefined {
    return this.byAid.get(aid)?.find((t) => t.type === 'main')?.title
  }

  /**
   * aid whose title matches `name` exactly (ignoring case, punctuation and latin diacritics).
   * If several anime match, the one where it is the main title wins, then official, synonym…, then the lowest aid.
   */
  lookup (name: string): number | undefined {
    const matches = this.byNormalized.get(normalizeTitle(name))
    if (!matches) {
      return undefined
    }
    return [ ...matches ].sort((a, b) => TYPE_BONUS[b.type] - TYPE_BONUS[a.type] || a.aid - b.aid)[0].aid
  }

  /**
   * search titles, best match per anime.
   * Exact matches rank first, then titles starting with the query, containing it, or containing all of its words.
   */
  search (query: string, options?: {
    /** max results, default 10 */
    limit?: number
    /** only match titles in these languages (e.g. `[ 'en', 'x-jat' ]`) */
    langs?: string[]
  }): AnimeTitleMatch[] {
    const q = normalizeTitle(query)
    if (!q) {
      return []
    }
    const qWords = q.split(' ')
    const langs = options?.langs
    const best = new Map<number, { entry: IndexedTitle, score: number }>()

    for (const entry of this.entries) {
      if (langs && !langs.includes(entry.lang)) {
        continue
      }
      const base = matchScore(entry, q, qWords)
      if (!base) {
        continue
      }
      const score = base + TYPE_BONUS[entry.type]
      const current = best.get(entry.aid)
      if (!current || score > current.score) {
        best.set(entry.aid, { entry, score })
      }
    }

    return [ ...best.values() ]
      .sort((a, b) => b.score - a.score || a.entry.aid - b.entry.aid)
      .slice(0, options?.limit ?? 10)
      .map(({ entry, score }) => ({
        ...strip(entry),
        main_title: this.mainTitle(entry.aid) ?? entry.title,
        score,
      }))
  }
}

function matchScore (entry: IndexedTitle, q: string, qWords: string[]): number {
  const { normalized, words } = entry
  if (normalized === q) {
    return 100
  }
  if (normalized.startsWith(q)) {
    return 80
  }
  if (` ${ normalized }`.includes(` ${ q }`)) {
    return 60
  }
  if (qWords.every((qw) => words.some((w) => w.startsWith(qw)))) {
    return 40
  }
  if (normalized.includes(q)) {
    return 20
  }
  return 0
}

function push<K, V> (map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [ value ])
  }
}
