import fs from 'fs'
import path from 'path'
import { parseAnime, parseXml } from '../HTTPAnimeParser'

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'http-anime.xml'), 'utf8')
const liveFixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'http-anime-6107.xml'), 'utf8')

describe('HTTPAnimeParser', () => {
  test('parses full anime xml', () => {
    expect(parseAnime(parseXml(fixture))).toMatchSnapshot()
  })

  test('parses a (trimmed) live response', () => {
    expect(parseAnime(parseXml(liveFixture))).toMatchSnapshot()
  })

  test('episode recap flag and resources', () => {
    const { episodes } = parseAnime(parseXml(liveFixture))
    expect(episodes.filter((e) => e.recap)).toHaveLength(1)
    expect(episodes.find((e) => e.resources.length > 0).resources[0]).toMatchObject({ type: 28 })
    expect(episodes.map((e) => e.epno.type).sort()).toEqual([ 1, 1, 2, 3, 4, 6 ])
  })

  test('single repeated elements are arrays', () => {
    const result = parseAnime(parseXml(fixture))
    expect(result.related_anime).toHaveLength(1)
    expect(result.creators).toHaveLength(1)
    expect(result.characters[0].seiyuu).toHaveLength(1)
  })

  test('keeps every identifier of an external entity', () => {
    const { resources } = parseAnime(parseXml(fixture))
    expect(resources.find((r) => r.type === 44).entities[0].identifiers).toEqual([ '85100', 'tv' ])
  })

  test('exposes <temporary> as ratings.mean', () => {
    const { ratings } = parseAnime(parseXml(fixture))
    expect(ratings.mean).toEqual({ value: 8.23, count: 4460 })
    expect(ratings).not.toHaveProperty('temporary')
  })

  test('prefers localspoiler over deprecated spoiler', () => {
    const { tags } = parseAnime(parseXml(fixture))
    expect(tags[1].local_spoiler).toBe(true)
  })

  test('missing optional sections', () => {
    const result = parseAnime(parseXml('<anime id="5" restricted="true"><type>Movie</type></anime>'))
    expect(result).toEqual({
      aid: 5,
      restricted: true,
      type: 'Movie',
      titles: [],
      related_anime: [],
      similar_anime: [],
      recommendations: [],
      creators: [],
      ratings: {},
      resources: [],
      tags: [],
      characters: [],
      episodes: [],
    })
  })
})
