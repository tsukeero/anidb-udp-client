import fs from 'fs'
import path from 'path'
import { AnidbHTTPClient, toAnidbError } from './AnidbHTTPClient'
import { AnidbTitles } from './AnidbTitles'
import { RESPONSE_CODE } from './common/responseCodeMap'

jest.mock('bottleneck', () => jest.fn().mockImplementation(() => ({
  schedule: (fn) => fn(),
})))

const fixture = fs.readFileSync(path.join(__dirname, 'parsers', '__tests__', 'fixtures', 'http-anime.xml'), 'utf8')

const response = (body, init = {}) => ({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body), ...init })

const memoryCache = () => {
  const data = new Map()
  return {
    data,
    get: jest.fn((key) => Promise.resolve(data.get(key))),
    set: jest.fn((key, value) => {
      data.set(key, value)
      return Promise.resolve()
    }),
  }
}

describe('AnidbHTTPClient', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('requires client id and integer version', () => {
    expect(() => new AnidbHTTPClient()).toThrow(TypeError)
    expect(() => new AnidbHTTPClient('client', '1')).toThrow(TypeError)
  })

  test('anime() sends the required params', async () => {
    fetchMock.mockResolvedValueOnce(response(fixture))
    const client = new AnidbHTTPClient('MyClient', 3, { cache: memoryCache(), logger: false })
    const result = await client.anime(1)

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(`${ url.origin }${ url.pathname }`).toBe('http://api.anidb.net:9001/httpapi')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client: 'myclient',
      clientver: '3',
      protover: '1',
      request: 'anime',
      aid: '1',
    })
    expect(result.aid).toBe(1)
    expect(result.titles[0]).toEqual({ title: 'Seikai no Monshou', lang: 'x-jat', type: 'main' })
  })

  test('anime() caches the raw xml under its own prefix', async () => {
    fetchMock.mockResolvedValueOnce(response(fixture))
    const cache = memoryCache()
    const client = new AnidbHTTPClient('client', 1, { cache, logger: false })

    const first = await client.anime(1)
    const second = await client.anime(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cache.data.get('HTTP_ANIME:1')).toBe(fixture)
    expect(second).toEqual(first)
  })

  test('anime() dedupes concurrent requests', async () => {
    fetchMock.mockResolvedValueOnce(response(fixture))
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false })

    const [ a, b ] = await Promise.all([ client.anime(1), client.anime(1) ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  test('cache: false still caches in memory', async () => {
    fetchMock.mockResolvedValueOnce(response(fixture))
    const client = new AnidbHTTPClient('client', 1, { cache: false, logger: false })

    await client.anime(1)
    await client.anime(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('maps <error> bodies to AnidbError', async () => {
    fetchMock.mockResolvedValueOnce(response('<error>Anime not found</error>'))
    const cache = memoryCache()
    const client = new AnidbHTTPClient('client', 1, { cache, logger: false })

    await expect(client.anime(999999)).rejects.toMatchObject({
      name: 'AnidbError',
      code: RESPONSE_CODE.NO_SUCH_ANIME,
      payload: { error: 'Anime not found' },
    })
    expect(cache.set).not.toHaveBeenCalled()
  })

  test('stops sending requests after a ban', async () => {
    fetchMock.mockResolvedValueOnce(response('<?xml version="1.0" encoding="UTF-8"?>\n<error>Banned</error>'))
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false })

    await expect(client.anime(1)).rejects.toMatchObject({ code: RESPONSE_CODE.BANNED })
    await expect(client.anime(2)).rejects.toMatchObject({ code: RESPONSE_CODE.BANNED })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('anime(title) resolves the aid through the titles index', async () => {
    fetchMock.mockResolvedValueOnce(response(fixture))
    const titles = AnidbTitles.fromBuffer('1|1|x-jat|Seikai no Monshou\n1|4|en|Crest of the Stars\n')
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false, titles })

    await client.anime('crest of the stars')

    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('aid')).toBe('1')
  })

  test('anime(title) without a match suggests titles and sends no request', async () => {
    const titles = AnidbTitles.fromBuffer('1|1|x-jat|Seikai no Monshou\n1|4|en|Crest of the Stars\n')
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false, titles })

    await expect(client.anime('crest')).rejects.toMatchObject({
      code: RESPONSE_CODE.NO_SUCH_ANIME,
      payload: { suggestions: [ expect.objectContaining({ aid: 1, title: 'Crest of the Stars' }) ] },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('anime(title) requires a titles index', async () => {
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false })
    await expect(client.anime('crest of the stars')).rejects.toThrow(TypeError)
  })

  describe('daily lists', () => {
    const hotanime = fs.readFileSync(path.join(__dirname, 'parsers', '__tests__', 'fixtures', 'http-hotanime.xml'), 'utf8')

    afterEach(() => {
      jest.useRealTimers()
    })

    test.each([
      [ 'hotAnime', 'hotanime', 'HTTP_HOTANIME:daily' ],
      [ 'randomRecommendation', 'randomrecommendation', 'HTTP_RANDOMRECOMMENDATION:daily' ],
      [ 'randomSimilar', 'randomsimilar', 'HTTP_RANDOMSIMILAR:daily' ],
      [ 'main', 'main', 'HTTP_MAIN:daily' ],
    ])('%s() sends request=%s and caches under %s', async (method, request, key) => {
      const xml = fs.readFileSync(path.join(__dirname, 'parsers', '__tests__', 'fixtures', `http-${ request }.xml`), 'utf8')
      fetchMock.mockResolvedValueOnce(response(xml))
      const cache = memoryCache()
      const client = new AnidbHTTPClient('client', 1, { cache, logger: false })

      const first = await client[method]()
      const second = await client[method]()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0]).searchParams)).toEqual({ client: 'client', clientver: '1', protover: '1', request })
      expect(cache.data.get(key)).toEqual({ fetched: expect.any(Number), xml })
      expect(second).toEqual(first)
    })

    test('refetches once the cached list is a day old', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-30T10:00:00Z'), doNotFake: [ 'nextTick', 'setImmediate', 'queueMicrotask' ] })
      fetchMock.mockResolvedValue(response(hotanime))
      const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false })

      await client.hotAnime()
      jest.setSystemTime(new Date('2026-10-31T09:59:00Z'))
      await client.hotAnime()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      jest.setSystemTime(new Date('2026-10-31T10:00:01Z'))
      await client.hotAnime()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    test('ignores cache entries in an unexpected shape', async () => {
      fetchMock.mockResolvedValueOnce(response(hotanime))
      const cache = memoryCache()
      cache.data.set('HTTP_HOTANIME:daily', hotanime)
      const client = new AnidbHTTPClient('client', 1, { cache, logger: false })

      await client.hotAnime()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  test('http and network failures become AnidbError', async () => {
    fetchMock.mockResolvedValueOnce(response('', { ok: false, status: 503, statusText: 'Service Unavailable' }))
    const client = new AnidbHTTPClient('client', 1, { cache: memoryCache(), logger: false })
    await expect(client.anime(1)).rejects.toMatchObject({ code: RESPONSE_CODE.UNKNOWN_API_ERROR, message: '[HTTP] anime failed: HTTP 503 Service Unavailable' })

    const timeout = new Error('timed out')
    timeout.name = 'TimeoutError'
    fetchMock.mockRejectedValueOnce(timeout)
    await expect(client.anime(1)).rejects.toMatchObject({ code: RESPONSE_CODE.CONNECTION_TIMEOUT })
  })
})

describe('toAnidbError', () => {
  test('ignores regular xml', () => {
    expect(toAnidbError(fixture)).toBeUndefined()
  })

  test('unknown error text', () => {
    expect(toAnidbError('<error>client version missing or invalid</error>')).toMatchObject({
      code: RESPONSE_CODE.UNKNOWN_API_ERROR,
      message: '[HTTP] client version missing or invalid',
    })
  })
})
