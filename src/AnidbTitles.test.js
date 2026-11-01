import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { AnidbTitles, normalizeTitle } from './AnidbTitles'

// trimmed from the real dump (2026-10-29): header + all titles of aid 1, 4, 979, 6107, 8895, 2643
const fixturePath = path.join(__dirname, '__tests__', 'fixtures', 'anime-titles.dat')
const fixture = fs.readFileSync(fixturePath)

describe('AnidbTitles', () => {
  const titles = AnidbTitles.fromBuffer(fixture)

  test('parses entries and header', () => {
    expect(titles.size).toBe(6)
    expect(titles.created).toEqual(new Date('Thu Oct 29 03:00:02 2026'))
    expect(titles.mainTitle(6107)).toBe('Hagane no Renkinjutsushi (2009)')
    expect(titles.titles(1)).toContainEqual({ aid: 1, type: 'official', lang: 'en', title: 'Crest of the Stars' })
    expect(titles.titles(123456)).toEqual([])
  })

  test('maps all title types', () => {
    const types = new Set(titles.titles(6107).map((t) => t.type))
    expect([ ...types ].sort()).toEqual([ 'card', 'kana', 'main', 'official', 'short', 'synonym' ])
  })

  test('keeps "|" inside titles', () => {
    expect(titles.mainTitle(8895)).toBe('Shin Evangelion Gekijouban:||')
    expect(titles.titles(2643)).toContainEqual({ aid: 2643, type: 'synonym', lang: 'zh-Hans', title: '赛亚人灭绝计划 ~地球篇|宇宙篇~' })
  })

  test('gzipped buffer, string and file give the same index', async () => {
    const fromGzip = AnidbTitles.fromBuffer(zlib.gzipSync(fixture))
    const fromString = AnidbTitles.fromBuffer(fixture.toString('utf8'))
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'anidb-titles-')), 'anime-titles.dat.gz')
    fs.writeFileSync(tmp, zlib.gzipSync(fixture))
    const fromFile = await AnidbTitles.fromFile(tmp)

    for (const other of [ fromGzip, fromString, fromFile ]) {
      expect(other.size).toBe(titles.size)
      expect(other.titles(6107)).toEqual(titles.titles(6107))
    }
  })

  test('ignores malformed lines and CRLF', () => {
    const t = AnidbTitles.fromBuffer('# created: nonsense\r\n1|1|x-jat|Seikai no Monshou\r\nbroken line\r\n2|9|en|unknown type\r\n')
    expect(t.created).toBeUndefined()
    expect(t.size).toBe(1)
    expect(t.mainTitle(1)).toBe('Seikai no Monshou')
  })

  describe('lookup', () => {
    test('exact title, ignoring case and punctuation', () => {
      expect(titles.lookup('hagane no renkinjutsushi (2009)')).toBe(6107)
      expect(titles.lookup('Fullmetal Alchemist Brotherhood')).toBe(6107)
      expect(titles.lookup('FMA B')).toBe(6107)
      expect(titles.lookup('Fullmetal Alchemist: Teräsalkemisti')).toBe(6107)
      expect(titles.lookup('fullmetal alchemist teraesalkemisti')).toBeUndefined()
      expect(titles.lookup('鋼の錬金術師 (2009)')).toBe(6107)
    })

    test('does not match partial titles', () => {
      expect(titles.lookup('Fullmetal')).toBe(979)
      expect(titles.lookup('Brotherhood')).toBeUndefined()
    })

    test('prefers the anime where the title has the better type', () => {
      const t = AnidbTitles.fromBuffer('1|2|en|Same Name\n2|1|en|Same Name\n3|4|en|Same Name\n')
      expect(t.lookup('same name')).toBe(2)
    })
  })

  describe('search', () => {
    test('best match per anime, exact first', () => {
      const results = titles.search('fullmetal alchemist')
      expect(results.map((r) => r.aid)).toEqual([ 979, 6107 ])
      expect(results[0]).toMatchObject({ title: 'Fullmetal Alchemist', type: 'official', main_title: 'Hagane no Renkinjutsushi' })
      expect(results[1].main_title).toBe('Hagane no Renkinjutsushi (2009)')
    })

    test('matches all words in any order', () => {
      expect(titles.search('brotherhood fullmetal').map((r) => r.aid)).toEqual([ 6107 ])
    })

    test('limit and langs', () => {
      expect(titles.search('a', { limit: 2 })).toHaveLength(2)
      expect(titles.search('Stalowy Alchemik', { langs: [ 'en' ] })).toEqual([])
      expect(titles.search('Stalowy Alchemik', { langs: [ 'pl' ] }).map((r) => r.aid)).toEqual([ 6107, 979 ])
    })

    test('empty query', () => {
      expect(titles.search(' :: ')).toEqual([])
    })
  })
})

describe('normalizeTitle', () => {
  test.each([
    [ 'FMA:B', 'fma b' ],
    [ 'Fullmetal Alchemist - Bratrství', 'fullmetal alchemist bratrstvi' ],
    [ 'ＦＵＬＬＭＥＴＡＬ', 'fullmetal' ],
    [ 'はがねのれんきんじゅつし', 'はがねのれんきんじゅつし' ],
    [ 'Philosopher`s Stone', 'philosopher s stone' ],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected)
  })
})
