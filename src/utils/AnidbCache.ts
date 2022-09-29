import { SimplePersistentCache } from './SimplePersistentCache'
import log from './log'
let static_cache_impl: SimplePersistentCache | undefined

type CachedReturn<T> = T | null | undefined
type CachableValue = string | number | Buffer | null | undefined | Record<string, any>

export interface AnidbCacheImplType {
  get<T extends CachableValue>(key: string): Promise<CachedReturn<T>>;
  set: (key: string, value: CachableValue) => Promise<void>;
}

function getImplInstance (cache: AnidbCacheImplType | false | null | undefined): AnidbCacheImplType {
  // if cache was set to false, than mock the cache so effectively there is no caching use
  if (cache === false) {
    return {
      get: (_key: Parameters<AnidbCacheImplType['get']>[0]) => Promise.resolve(null),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      set: (_key: Parameters<AnidbCacheImplType['set']>[0], _value: Parameters<AnidbCacheImplType['set']>[1]) => Promise.resolve(),
    }
  // if cache is falesy use the included implementation (singleton)
  } else if (!cache) {
    if (!static_cache_impl) {
      static_cache_impl = new SimplePersistentCache({
        stdTTL: 604800, // 7 days
        checkperiod: 1800, // 30 minutes
      })
    }

    return static_cache_impl
  } else {
    return cache
  }
}

export class AnidbCache {
  cache!: AnidbCacheImplType

  constructor (cache_implementation?: AnidbCacheImplType | false) {
    // promisify myself!

    this.cache = getImplInstance(cache_implementation)
    //  Promise.promisifyAll(impl)
  }
  public get<T extends CachableValue> (
    command: string,
    id: string | number,
    options: {
      validator?: (cached_obj: CachedReturn<T>) => boolean
      onMiss: (get_result: T | Partial<T> | null | undefined) => Promise<{ id: string| number, aliases?: string[], value: T} | T | null | undefined>
    }): Promise<T>
  public get<T extends CachableValue> (
      command: string,
      id: string | number,
      options?: {
        validator?: (cached_obj: CachedReturn<T>) => boolean
      }): Promise<T | undefined | null>

  public async get<T extends CachableValue> (
    command: string,
    id: string | number,
    options?: {
      validator?: (cached_obj: CachedReturn<T>) => boolean
      onMiss?: (get_result: T | Partial<T> | null | undefined) => Promise<{ id: string| number, aliases?: string[], value: T} | T | null | undefined>
    }): Promise<T | undefined | null> {
    const {
      cache,
    } = this

    const validator = options?.validator
    let get_result: T | Partial<T> | null | undefined

    // eslint-disable-next-line no-async-promise-executor
    const cache_promise = new Promise<CachedReturn<T>>(async (res, rej) => {
      try {
        let r = await cache.get<CachedReturn<T>>(`${ command }:${ id }`)

        if (r !== null && typeof r === 'string' && r.startsWith('ALIASOF:')) {
          const match = r.match(/ALIASOF:(.*)/)
          const actual_id = match && match[1]
          r = await cache.get(`${ command }:${ actual_id }`)
        }

        // this is wierd, but yea...
        get_result = r
        return validator ? validator(r) ? res(r) : res(null) : res(r)
      } catch (e) {
        rej(e)
      }
    })

    if (options?.onMiss) {
      const cache_result = await cache_promise
      if (!cache_result) {
        const missResult = await options?.onMiss(get_result)
        // type Test = typeof missResult extends { id: string| number, aliases?: string[], value: T} ? { id: string| number, aliases?: string[], value: T} : T

        if (missResult && typeof missResult === 'object' && 'id' in missResult && Array.isArray(missResult.aliases)) {
          await cache.set(`${ command }:${ missResult.id }`, missResult.value)

          for (const alias of missResult.aliases.filter((a:string) => !!a)) {
            await cache.set(`${ command }:${ alias }`, `ALIASOF:${ missResult.id }`)
          }

          return missResult.value

        } else if (missResult) {
          await cache.set(`${ command }:${ id }`, missResult)
          return missResult as T
        } else {
          return null
        }

      } else {
        return cache_result
      }

    } else {
      return cache_promise
    }
  }
}

// const test = async () => {

//   const c = new AnidbCache()
//   const a = new SP({
//     'asd': Number,
//   })

//   return c.get('asd', 'id', { onMiss: () => Promise.resolve(a.parseData('test')) } )
// // return ""
// }

// const test2 = await test()