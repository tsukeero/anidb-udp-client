# anidb-udp-client &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/tsukeero/anidb-udp-client/blob/main/LICENSE) [![Tests](https://img.shields.io/github/workflow/status/tsukeero/anidb-udp-client/Tests)](https://github.com/tsukeero/anidb-udp-client/actions/workflows/tests.yml) [![Coverage](https://img.shields.io/codecov/c/gh/tsukeero/anidb-udp-client)](https://codecov.io/github/tsukeero/anidb-udp-client)

`anidb-udp-client` is a library for Node.js that facilitates the use of [Anidb's](https://anidb.net/) [UDP API](https://wiki.anidb.net/UDP_API_Definition). It handles the UDP connection, encoding/decoding requests and responses, rate limiting and caching (can be disabled) and provides typescript type definitions for all methods.
If you plan to use the library for your project I strongly suggest to add your project to: https://anidb.net/software/add and use  your own name for `clientid`

## Docs
https://tsukeero.github.io/anidb-udp-client/

## Installation

NPM: `npm install anidb-udp-client`

Yarn: `yarn add anidb-udp-client`

## Usage

### Basic example

```js
import { AnidbUDPClient } from 'anidb-udp-client'

const anidb_client =  new AnidbUDPClient('my-anime-client')

await anidb_client.connect('anidb_username', 'anidb_passowrd')

const anime = await anidb_client.anime(117, [ 'english_name', 'rating' ])

console.log(`${anime.english_name}: rating ${anime.rating}`)

await anidb_client.disconnect()

```
### Custom cache path path
```js
import { AnidbUDPClient, SimplePersistentCache} from 'anidb-udp-client'

const cache = new SimplePersistentCache({save_path: '/tmp/'})
const anidb_client = const myanidb = new AnidbUDPClient('my-anime-client', { cache } )
```


### Example with cache on redis
NOTE: when using custom cache make sure TTL for every `anidb-udp-client` related key is set to a reasonable amount. Long living cache can become stale.

```js
import { createClient } from 'redis';
import { AnidbUDPClient } from 'anidb-udp-client'


class RedisCache {
    #redisClient
    constructor(){
        this.#redisClient = createClient();
        }
     async connect() {
        await this.#redisClient.connect();
     }

     async get(key) {
        const result = await this.#redisClient.get(key)
        return JSON.parse(result)
     }
    async set(key, value) {
         //can use key.startsWith() to set TTL for different result types: 'ANIME:', 'FILE:', ...
        await this.#redisClient.set(key, JSON.stringify(value), {EX: 2592000 })
     }
}


const cache = new RedisCache()
await cache.connect()

const anidb_client = new AnidbUDPClient('my-anime-client', { cache } )
```