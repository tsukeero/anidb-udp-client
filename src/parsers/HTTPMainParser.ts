import { attr, bool, compact, list, num, rating, text, title } from './HTTPXml'
import type { HTTPRating, HTTPTitle, XmlNode } from './HTTPXml'

/** short anime entry used by `hotanime` and `randomrecommendation`; fields are often missing (e.g. `type` in `hotanime`) */
export type HTTPAnimeSummary = {
  aid: number
  restricted: boolean
  type?: string
  episode_count?: number
  start_date?: string
  end_date?: string
  titles: HTTPTitle[]
  picture?: string
  ratings: {
    permanent?: HTTPRating
    /** mean of all votes; anidb sends this as `<temporary>` */
    mean?: HTTPRating
  }
}

export type HTTPRecommendedAnime = HTTPAnimeSummary & {
  /**
   * `<recommendations>` value sent with the list. Meaning unclear: it is **not** the number of recommendation
   * reviews on the anime (aid 3146: 12 here, 2 reviews in the `anime` response)
   */
  recommendations?: number
}

export type HTTPSimilarAnimeRef = {
  aid: number
  restricted: boolean
  titles: HTTPTitle[]
  picture?: string
}

export type HTTPSimilarPair = { source: HTTPSimilarAnimeRef, target: HTTPSimilarAnimeRef }

export type HTTPMainResult = {
  hot_anime: HTTPAnimeSummary[]
  random_recommendations: HTTPRecommendedAnime[]
  random_similar: HTTPSimilarPair[]
}

// `randomrecommendation` sends ratings in hundredths (`418` for 4.18), checked against the `anime` response for aid 3146
const RECOMMENDATION_RATING_SCALE = 100

const summary = (anime: XmlNode, ratingScale = 1): HTTPAnimeSummary => compact({
  aid: Number(attr(anime, 'id')),
  restricted: bool(attr(anime, 'restricted')),
  type: text(anime.type),
  episode_count: num(text(anime.episodecount)),
  start_date: text(anime.startdate),
  end_date: text(anime.enddate),
  titles: list(anime.title).map(title),
  picture: text(anime.picture),
  ratings: compact({
    permanent: rating(anime.ratings?.permanent, ratingScale),
    mean: rating(anime.ratings?.temporary, ratingScale),
  }),
})

const similarRef = (node: XmlNode): HTTPSimilarAnimeRef => compact({
  aid: Number(attr(node, 'aid')),
  restricted: bool(attr(node, 'restricted')),
  titles: list(node.title).map(title),
  picture: text(node.picture),
})

const hotAnime = (section: XmlNode | undefined): HTTPAnimeSummary[] => list(section?.anime).map((a) => summary(a))

const randomRecommendations = (section: XmlNode | undefined): HTTPRecommendedAnime[] => list(section?.recommendation).map((r) => compact({
  ...summary(r.anime, RECOMMENDATION_RATING_SCALE),
  recommendations: num(text(r.anime?.ratings?.recommendations)),
}))

const randomSimilar = (section: XmlNode | undefined): HTTPSimilarPair[] => list(section?.similar).map((s) => ({
  source: similarRef(s.source),
  target: similarRef(s.target),
}))

export const parseHotAnime = (doc: XmlNode): HTTPAnimeSummary[] => hotAnime(doc.hotanime)

export const parseRandomRecommendation = (doc: XmlNode): HTTPRecommendedAnime[] => randomRecommendations(doc.randomrecommendation)

export const parseRandomSimilar = (doc: XmlNode): HTTPSimilarPair[] => randomSimilar(doc.randomsimilar)

/** `main` is the three lists above wrapped in `<main>` */
export const parseMain = (doc: XmlNode): HTTPMainResult => ({
  hot_anime: hotAnime(doc.main?.hotanime),
  random_recommendations: randomRecommendations(doc.main?.randomrecommendation),
  random_similar: randomSimilar(doc.main?.randomsimilar),
})
