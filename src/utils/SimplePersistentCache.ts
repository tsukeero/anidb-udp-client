import NodeCache from 'node-cache'
import path from 'path'
// import Promise from 'bluebird'
import log from './log'
import fs from 'fs'
import type { AnidbCacheImplType } from './AnidbCache'

/**
 * Simple persistent cache implementation, used by default by {@link AnidbUDPClient}.
 * Cache is in memory, but will attempt to save (`./.cache` by default) on exit, and load on initialization
  */
export class SimplePersistentCache implements AnidbCacheImplType {
  private innerCache!: NodeCache
  private cache_file!: string
  private exitSaved = false


  constructor (params: {
    /** directory where to save the `.cache` file  */
    save_path?: string
  } & NodeCache.Options) {
    const {
      save_path,
      ...orig_params
    } = params
    this.innerCache = new NodeCache(orig_params)
    this.cache_file = path.resolve(save_path || process.cwd(), '.cache')
    this.load()
    process.once('beforeExit',() => {
      if (!this.exitSaved) {
        this.exitSaved = true
        this.save()
      }
    })
  }
  get<T> (key: string): Promise<T | undefined | null> {
    return Promise.resolve(this.innerCache.get(key))
  }
  set = (...args: Parameters<AnidbCacheImplType['set']>) => {
    this.innerCache.set(args[0], args[1])
    return Promise.resolve()
  }

  private load = () => {
    try {
      const cache_string = fs.readFileSync(this.cache_file, {
        encoding: 'utf8',
      })

      const _cache = JSON.parse(cache_string) || {}

      if (!_cache.stats || !_cache.data) {
        throw new Error('Invalid cache data, ignoring...')
      }

      this.innerCache.data = _cache.data
      this.innerCache.stats = _cache.stats

    } catch (e: any) {
      if (e && e.code && e.code === 'ENOENT') {
        log.debug('[CACHE] Missing cache file, satrting fresh')
      } else {
        log.warn('[CACHE] failed to load file:', e)
      }
    }
  }

  private save = () => {
    const {
      data,
      stats,
    } = this.innerCache

    try {
      fs.writeFileSync(this.cache_file, JSON.stringify({
        data,
        stats,
      }), {
        encoding: 'utf8',
      })
      log.info(`[CACHE] saved cache to  ${ this.cache_file }`)
    } catch (e) {
      log.warn('[CACHE] Could not save cache:', e)
    }
  }
}