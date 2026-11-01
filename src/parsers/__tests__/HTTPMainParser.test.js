import fs from 'fs'
import path from 'path'
import { parseXml } from '../HTTPXml'
import { parseHotAnime, parseMain, parseRandomRecommendation, parseRandomSimilar } from '../HTTPMainParser'

const load = (name) => parseXml(fs.readFileSync(path.join(__dirname, 'fixtures', `http-${ name }.xml`), 'utf8'))

describe('HTTPMainParser', () => {
  test('hotanime', () => {
    const result = parseHotAnime(load('hotanime'))
    expect(result).toHaveLength(10)
    expect(result).toMatchSnapshot()
    expect(result[0]).toMatchObject({
      aid: 19444,
      restricted: false,
      titles: [{ title: 'Kusuriya no Hitorigoto (2026)', lang: 'x-jat', type: 'main' }],
      ratings: { permanent: { value: 9.09, count: 35 }, mean: { value: 8.16, count: 36 } },
    })
  })

  test('hotanime entries with missing fields', () => {
    const result = parseHotAnime(load('hotanime'))
    expect(result.filter((a) => a.episode_count === undefined).length).toBeGreaterThan(0)
    expect(result.every((a) => a.type === undefined)).toBe(true)
  })

  test('randomrecommendation scales ratings from hundredths', () => {
    const result = parseRandomRecommendation(load('randomrecommendation'))
    expect(result).toHaveLength(10)
    expect(result).toMatchSnapshot()
    expect(result.find((a) => a.aid === 3146)).toMatchObject({
      type: 'Movie',
      ratings: { permanent: { value: 4.18, count: 4244 } },
      recommendations: 12,
    })
  })

  test('randomsimilar', () => {
    const result = parseRandomSimilar(load('randomsimilar'))
    expect(result).toHaveLength(10)
    expect(result).toMatchSnapshot()
    expect(result[0]).toEqual({
      source: { aid: 13893, restricted: false, titles: [{ title: 'Carole & Tuesday', lang: 'x-jat', type: 'main' }], picture: '258360.jpg' },
      target: { aid: 4143, restricted: false, titles: [{ title: 'Nana', lang: 'x-jat', type: 'main' }], picture: '321080.jpg' },
    })
  })

  test('main combines the three lists', () => {
    expect(parseMain(load('main'))).toEqual({
      hot_anime: parseHotAnime(load('hotanime')),
      random_recommendations: parseRandomRecommendation(load('randomrecommendation')),
      random_similar: parseRandomSimilar(load('randomsimilar')),
    })
  })

  test('empty responses', () => {
    expect(parseHotAnime(parseXml('<hotanime></hotanime>'))).toEqual([])
    expect(parseMain(parseXml('<main></main>'))).toEqual({ hot_anime: [], random_recommendations: [], random_similar: [] })
  })
})
