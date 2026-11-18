import { attr, bool, compact, list, num, rating, text, title } from './HTTPXml'
import type { HTTPRating, HTTPTitle, XmlNode } from './HTTPXml'

export { parseXml } from './HTTPXml'
export type { HTTPRating, HTTPTitle } from './HTTPXml'

// dates are kept as the `YYYY-MM-DD` strings anidb sends, so results survive a JSON round trip (custom caches)
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

const resources = (node: XmlNode | undefined): HTTPResource[] => list(node?.resource).map((r) => ({
  type: Number(attr(r, 'type')),
  entities: list(r.externalentity).map((e) => ({
    identifiers: list(e.identifier).map((i) => text(i) ?? ''),
    urls: list(e.url).map((u) => text(u) ?? ''),
  })),
}))

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
