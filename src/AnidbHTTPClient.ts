import Bottleneck from 'bottleneck'
import NodeCache from 'node-cache'
import log, { forceEnableDebugLog, setLog, AnidbLoggerType } from './utils/log'
import { AnidbError } from './common/AnidbError'
import { RESPONSE_CODE } from './common/responseCodeMap'
import { AnidbCache } from './utils/AnidbCache'
import type { AnidbCacheImplType } from './utils/AnidbCache'
import { parseAnime, parseXml } from './parsers/HTTPAnimeParser'
import type { HTTPAnimeResult } from './parsers/HTTPAnimeParser'

const BASE_URL = 'http://api.anidb.net:9001/httpapi'
const PROT_VER = 1
// anidb allows at most one request every 2 seconds
const REQ_INTERVAL = 2000
const REQ_TIMEOUT = 30000
// used when cache is disabled: anidb bans clients requesting the same data more than once a day
const MIN_CACHE_TTL = 86400

/**
 * Client for the AniDB [HTTP API](https://wiki.anidb.net/HTTP_API_Definition).
 *
 * It needs its own client registration, separate from the UDP one.
 * Responses are cached (the raw XML is stored, so parser fixes apply to cached entries too) and requests are throttled.
 */
export class AnidbHTTPClient {
  private cache!: AnidbCache
  private clientId!: string
  private clientVer!: number
  private requestQueue!: Bottleneck
  private inFlight = new Map<string, Promise<any>>()
  private bannedError: AnidbError | undefined

  /**
   *
   * @example
   * ```ts
   * import { AnidbHTTPClient } from 'anidb-udp-client'
   * const anidbHttp = new AnidbHTTPClient('myhttpclient', 1)
   * ```
   * @param clientId client id registered for the HTTP API (lower case), add your own here: https://anidb.net/software/add
   * @param clientVer registered version of that client
   */
  constructor (
    clientId: string,
    clientVer: number,
    options?: {
      /** pass cache implementation:
       *  by default (`undefined`) it will use the internal cache shared with {@link AnidbUDPClient}, that saves to `{cwd}/.cache`
       *  if set to `false` an in-memory cache with a 1 day lifetime is still used, since anidb bans repeated requests
       *  if instance of {@link AnidbCacheImplType}  it will use that instead *
       */
      cache?: AnidbCacheImplType | false;
      /** Logger: default is using console.log, if `false` logging will be disabled, or pass a function */
      logger?: false | AnidbLoggerType;
      /** enable/disable debug logging */
      debug?: true;
    }
  ) {
    if (!clientId || !Number.isInteger(clientVer)) {
      throw new TypeError('AnidbHTTPClient requires a client id and an integer client version')
    }
    this.clientId = clientId.toLowerCase()
    this.clientVer = clientVer

    const {
      cache,
      logger,
      debug,
    } = options || {}

    if (debug) {
      forceEnableDebugLog()
    }

    if (logger === false) {
      setLog()
    } else if (logger) {
      setLog(logger)
    }

    if (cache === false) {
      log.warn('[HTTP] cache disabled, using an in-memory cache instead: requesting the same data more than once a day can get you banned')
      const memory = new NodeCache({ stdTTL: MIN_CACHE_TTL, checkperiod: 1800 })
      this.cache = new AnidbCache({
        get: (key) => Promise.resolve(memory.get(key)),
        set: (key, value) => {
          memory.set(key, value)
          return Promise.resolve()
        },
      })
    } else {
      this.cache = new AnidbCache(cache)
    }

    this.requestQueue = new Bottleneck({
      maxConcurrent: 1,
      minTime: REQ_INTERVAL,
    })
  }

  /**
   * @private
   * Throttled request, returns the raw XML body. Throws {@link AnidbError} on anidb `<error>` responses.
   */
  _callApi = (request: string, params?: Record<string, string | number>): Promise<string> => {
    if (this.bannedError) {
      return Promise.reject(this.bannedError)
    }

    const query = new URLSearchParams({
      client: this.clientId,
      clientver: String(this.clientVer),
      protover: String(PROT_VER),
      request,
      ...Object.fromEntries(Object.entries(params || {}).map(([ k, v ]) => [ k, String(v) ])),
    })

    return this.requestQueue.schedule(async () => {
      // re-check, a ban may have arrived while this request was queued
      if (this.bannedError) {
        throw this.bannedError
      }
      log.debug(`[HTTP] request: ${ request }`, params)

      let body: string
      try {
        const res = await fetch(`${ BASE_URL }?${ query }`, { signal: AbortSignal.timeout(REQ_TIMEOUT) })
        if (!res.ok) {
          throw new Error(`HTTP ${ res.status } ${ res.statusText }`)
        }
        body = await res.text()
      } catch (e: any) {
        const code = e?.name === 'TimeoutError' ? RESPONSE_CODE.CONNECTION_TIMEOUT : RESPONSE_CODE.UNKNOWN_API_ERROR
        throw new AnidbError(code, `[HTTP] ${ request } failed: ${ e?.message }`)
      }

      const error = toAnidbError(body)
      if (error) {
        if (error.code === RESPONSE_CODE.BANNED) {
          this.bannedError = error
        }
        throw error
      }
      return body
    })
  }

  /** run `fn` once per key at a time, concurrent callers share the same promise */
  private dedupe<T> (key: string, fn: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(key)
    if (pending) {
      return pending
    }
    const promise = fn().finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, promise)
    return promise
  }

  /**
   * get full anime data by aid
   * @throws {@link AnidbError} `NO_SUCH_ANIME` if the anime does not exist
   * @group Data Commands
   */
  anime (aid: number): Promise<HTTPAnimeResult> {
    const command = 'HTTP_ANIME'
    return this.dedupe(`${ command }:${ aid }`, async () => {
      const xml = await this.cache.get<string>(command, aid, {
        validator: (cached) => typeof cached === 'string' && cached.length > 0,
        onMiss: () => this._callApi('anime', { aid }),
      })
      return parseAnime(parseXml(xml))
    })
  }
}

const KNOWN_ERRORS: [RegExp, typeof RESPONSE_CODE[keyof typeof RESPONSE_CODE]][] = [
  [ /banned/i, RESPONSE_CODE.BANNED ],
  [ /anime not found/i, RESPONSE_CODE.NO_SUCH_ANIME ],
]

/** anidb signals errors in the body (`<error>Banned</error>`), not with http status codes */
export function toAnidbError (body: string): AnidbError | undefined {
  const match = body.match(/^\s*(?:<\?xml[^>]*\?>\s*)?<error[^>]*>([\s\S]*?)<\/error>\s*$/)
  if (!match) {
    return undefined
  }
  const message = match[1].trim()
  const known = KNOWN_ERRORS.find(([ pattern ]) => pattern.test(message))
  return new AnidbError(known ? known[1] : RESPONSE_CODE.UNKNOWN_API_ERROR, `[HTTP] ${ message }`, { error: message })
}
