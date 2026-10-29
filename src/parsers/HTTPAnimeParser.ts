import { XMLParser } from 'fast-xml-parser'

// dates are kept as the `YYYY-MM-DD` strings anidb sends, so results survive a JSON round trip (custom caches)
export type HTTPTitle = { title: string, lang: string, type?: string }
export type HTTPRating = { value: number, count: number }
/** link to an external site; `type` is a numeric site id, identifiers are positional (e.g. `[ '85100', 'tv' ]`) */
export type HTTPResource = { type: number, entities: { identifiers: string[], urls: string[] }[] }

export type HTTPAnimeResult = {
  aid: number
  restricted: boolean
  type?: string
  episode_count?: number
  start_date?: string
  end_date?: string
  titles: HTTPTitle[]
  related_anime: { aid: number, type: string, title: string }[]
  similar_anime: { aid: number, approval: number, total: number, title: string }[]
  recommendations: { type: string, uid: number, text: string }[]
  url?: string
  creators: { id: number, type: string, name: string }[]
  description?: string
  ratings: {
    permanent?: HTTPRating
    /** mean of all votes; anidb sends this as `<temporary>` for historical reasons */
    mean?: HTTPRating
    review?: HTTPRating
  }
  picture?: string
  resources: HTTPResource[]
  tags: {
    id: number
    parent_id?: number
    name: string
    description?: string
    weight: number
    local_spoiler: boolean
    global_spoiler: boolean
    verified: boolean
    infobox: boolean
    update?: string
    picture?: string
  }[]
  characters: {
    id: number
    type: string
    update?: string
    rating?: HTTPRating
    name: string
    gender?: string
    character_type?: { id: number, name: string }
    description?: string
    picture?: string
    seiyuu: { id: number, name: string, picture?: string }[]
  }[]
  episodes: {
    id: number
    update?: string
    epno: { type: number, value: string }
    length?: number
    air_date?: string
    rating?: HTTPRating
    summary?: string
    recap: boolean
    titles: HTTPTitle[]
    resources: HTTPResource[]
  }[]
}

type XmlNode = Record<string, any>

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  alwaysCreateTextNode: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

export function parseXml (xml: string): XmlNode {
  return xmlParser.parse(xml)
}

const list = (node: unknown): XmlNode[] => node === undefined || node === null || node === '' ? [] : Array.isArray(node) ? node : [ node as XmlNode ]

const text = (node: unknown): string | undefined => {
  if (node === undefined || node === null) {
    return undefined
  }
  if (typeof node === 'object') {
    const value = (node as XmlNode)['#text']
    return value === undefined ? undefined : String(value)
  }
  return String(node)
}

const num = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

const bool = (value: unknown): boolean => value === 'true' || value === '1'

const attr = (node: unknown, name: string): string | undefined => node && typeof node === 'object' ? (node as XmlNode)[`@_${ name }`] : undefined

const rating = (node: unknown): HTTPRating | undefined => {
  const value = num(text(node))
  return value === undefined ? undefined : { value, count: num(attr(node, 'count') ?? attr(node, 'votes')) ?? 0 }
}

const title = (node: XmlNode): HTTPTitle => ({
  title: text(node) ?? '',
  lang: attr(node, 'xml:lang') ?? '',
  ...attr(node, 'type') ? { type: attr(node, 'type') } : {},
})

const resources = (node: XmlNode | undefined): HTTPResource[] => list(node?.resource).map((r) => ({
  type: Number(attr(r, 'type')),
  entities: list(r.externalentity).map((e) => ({
    identifiers: list(e.identifier).map((i) => text(i) ?? ''),
    urls: list(e.url).map((u) => text(u) ?? ''),
  })),
}))

/** drop keys whose value is `undefined`, so results are stable for snapshots / JSON */
const compact = <T extends Record<string, any>>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([ , v ]) => v !== undefined)) as T

export function parseAnime (doc: XmlNode): HTTPAnimeResult {
  const anime = doc.anime

  return compact({
    aid: Number(attr(anime, 'id')),
    restricted: bool(attr(anime, 'restricted')),
    type: text(anime.type),
    episode_count: num(text(anime.episodecount)),
    start_date: text(anime.startdate),
    end_date: text(anime.enddate),
    titles: list(anime.titles?.title).map(title),
    related_anime: list(anime.relatedanime?.anime).map((a) => ({
      aid: Number(attr(a, 'id')),
      type: attr(a, 'type') ?? '',
      title: text(a) ?? '',
    })),
    similar_anime: list(anime.similaranime?.anime).map((a) => ({
      aid: Number(attr(a, 'id')),
      approval: num(attr(a, 'approval')) ?? 0,
      total: num(attr(a, 'total')) ?? 0,
      title: text(a) ?? '',
    })),
    recommendations: list(anime.recommendations?.recommendation).map((r) => ({
      type: attr(r, 'type') ?? '',
      uid: Number(attr(r, 'uid')),
      text: text(r) ?? '',
    })),
    url: text(anime.url),
    creators: list(anime.creators?.name).map((c) => ({
      id: Number(attr(c, 'id')),
      type: attr(c, 'type') ?? '',
      name: text(c) ?? '',
    })),
    description: text(anime.description),
    ratings: compact({
      permanent: rating(anime.ratings?.permanent),
      mean: rating(anime.ratings?.temporary),
      review: rating(anime.ratings?.review),
    }),
    picture: text(anime.picture),
    resources: resources(anime.resources),
    tags: list(anime.tags?.tag).map((t) => compact({
      id: Number(attr(t, 'id')),
      parent_id: num(attr(t, 'parentid')),
      name: text(t.name) ?? '',
      description: text(t.description),
      weight: num(attr(t, 'weight')) ?? 0,
      // `spoiler` is deprecated by anidb in favour of `localspoiler`
      local_spoiler: bool(attr(t, 'localspoiler') ?? attr(t, 'spoiler')),
      global_spoiler: bool(attr(t, 'globalspoiler')),
      verified: bool(attr(t, 'verified')),
      infobox: bool(attr(t, 'infobox')),
      update: attr(t, 'update'),
      picture: text(t.picurl),
    })),
    characters: list(anime.characters?.character).map((c) => compact({
      id: Number(attr(c, 'id')),
      type: attr(c, 'type') ?? '',
      update: attr(c, 'update'),
      rating: rating(c.rating),
      name: text(c.name) ?? '',
      gender: text(c.gender),
      character_type: c.charactertype ? { id: Number(attr(c.charactertype, 'id')), name: text(c.charactertype) ?? '' } : undefined,
      description: text(c.description),
      picture: text(c.picture),
      seiyuu: list(c.seiyuu).map((s) => compact({
        id: Number(attr(s, 'id')),
        name: text(s) ?? '',
        picture: attr(s, 'picture'),
      })),
    })),
    episodes: list(anime.episodes?.episode).map((e) => compact({
      id: Number(attr(e, 'id')),
      update: attr(e, 'update'),
      epno: { type: Number(attr(e.epno, 'type')), value: text(e.epno) ?? '' },
      length: num(text(e.length)),
      air_date: text(e.airdate),
      rating: rating(e.rating),
      summary: text(e.summary),
      recap: bool(attr(e, 'recap')),
      titles: list(e.title).map(title),
      resources: resources(e.resources),
    })),
  })
}
