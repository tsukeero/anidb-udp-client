import log, { forceEnableDebugLog, setLog, AnidbLoggerType } from './utils/log'
import Bottleneck from 'bottleneck'
import {
  AnidbError,
  FATAL_ERROR_CODES,
} from './common/AnidbError'
import { RESPONSE_CODE } from './common/responseCodeMap'
import { AnidbCache } from './utils/AnidbCache'
import type { AnidbCacheImplType } from './utils/AnidbCache'
const PING_INTERVAL = 300000
const REQ_INTERVAL = 4000
const PROT_VER = 3
// PARSERS
import {
  Dateflags,
  MapFieldStatic,
  CodedField,
  StringWithLineBreaks,
  ListField,
  NumBoolean,
} from './parsers/field_types'
import FileParser from './parsers/FileParser'
import type { FileResult } from './parsers/FileParser'
import AnimeParser from './parsers/AnimeParser'
import type { AnimeResult } from './parsers/AnimeParser'
import SimpleParser from './parsers/SimpleParser'
import type { Socket as DgramSocket } from 'dgram'
import nameOrId from './utils/nameOrId'
import { initUDPClient, UDPRequest, ParsedResponse } from './utils/udp_utils'
type NullablePromise<T> = Promise<T | null | undefined>
import { EncodingType, ENCODINGS } from './common/constants'
import reverseObj from './utils/reverseObj'
import { EventEmitter } from 'events'
// const udpRequester = fakeUDPRequest
const udpRequester = UDPRequest

// type constants
const MylistStates = {
  '0': 'unknown',
  '1': 'internal_storage',
  '2': 'external_storage',
  '3': 'deleted',
  '4': 'remote_storage',
} as const

const EXPORT_TEMPLATES = [ 'csv-adborg', 'csv-files', 'csv-minimal', 'html-anidbstyle', 'html-cleancut', 'html-cloud', 'html-dump', 'html-fixme', 'html-fstyle', 'html-goldsilver', 'html-graywhite', 'html-green', 'html-knch', 'html-lightblue', 'html-operatic', 'html-orangewhite', 'html-silver', 'json-adborg', 'json-large', 'plot-time-wasted', 'sfv-simple', 'txt-ed2k', 'txt-udp-mylist', 'xml', 'xml-acm', 'xml-anivote', 'xml-cdb', 'xml-dark', 'xml-files', 'xml-large', 'xml-mini', 'xml-mystatus', 'xml-naive', 'xml-nx', 'xml-plain', 'xml-plain-anisubtwo', 'xml-plain-cs', 'xml-plain-full', 'xml-plain-new', 'xml-xslt' ] as const

const VOTE_TYPES = { 'anime': '1', 'anime_tmp': '2', 'group': '3', 'episode': '6' } as const

export class AnidbUDPClient extends EventEmitter {
  // internals
  private cache!: AnidbCache
  private clientId!: string
  private incomming_port: number | undefined
  private requestQueue!: Bottleneck
  private lastRequest: number | null | undefined
  private pingInterval: number

  #pingTimer: NodeJS.Timeout | undefined
  // just hidden from docs
  /** @ignore */
  client: DgramSocket| null | undefined
  /** @ignore */
  session: string | null | undefined

  /**
   * valid events to listen to
   * @event
   * */
  static readonly EVENTS = {
    /** on disconnect from udp connection */
    DISCONNECT: 'disconnect',
  } as const

  /**
   *
   * @example
   * ```ts
   * import { AnidbUDPClient } from 'anidb-udp-client'
   * const anidbClient = new AnidbUDPClient('someclientid', {debug: true})
   * ```
   * @param clientId client id, add your own here: https://anidb.net/software/add
   */
  constructor (
    clientId?: string,
    options?: {
      /** pass cache implementation:
       *  by default (`undefined`) it will use internal cache, that saves to `{cwd}/.cache`
       *  if set to `false` cache won't be used
       *  if instance of {@link AnidbCacheImplType}  it will use that instead *
       */
      cache?: AnidbCacheImplType;
      /** the port to listen to for response (leave `undefined` if you are not sure) */
      incomming_port?: number;
      /** Logger: default is using console.log, if `false` logging will be disabled, or pass a function */
      logger?: false | AnidbLoggerType;
      /** enable/disable debug logging */
      debug?: true;
      /** define the interval in miliseconds at which anidb is pinged to keep the connection active, defaults to 5minutes  */
      ping_interval?: number;
    }
  ) {
    super()
    this.clientId = clientId || 'anidb-udp-client'
    this.session = null
    const {
      cache,
      incomming_port,
      logger,
      debug,
      ping_interval,
    } = options || {}

    this.pingInterval = ping_interval || PING_INTERVAL

    if (debug) {
      forceEnableDebugLog()
    }

    if (logger === false) {
      // disable logger
      setLog()

    } else if (logger) {
      // set custom logger
      setLog(logger)
    }

    this.incomming_port = incomming_port // || 41234

    this.cache = new AnidbCache(cache)
  }


  /**
   * Start the connection to anidb. It will automatically log in if user and password is provided. This client will try to keep the session alive indefenetly, so make sure to call {@link AnidbUDPClient.disconnect} when you stop using.
   * For long running services try to be clever and disconnect when there is no activity for a while.
   *
   * @example
   * ```ts
   * const anidb = new AnidbUDPClient('myclientid')
   * await anidb.connect("my-user","my-password")
   * await anidb.disconnect()
   * ```
   * @category Connection Commands
   */
  async connect (
    /** anidb user */
    user?: string,
    /** anidb password */
    password?: string,
    /** set the encoding (only applies if user and password was passed) */
    encoding?: EncodingType
  ) {
    this.requestQueue = new Bottleneck({
      maxConcurrent: 1,
      minTime: REQ_INTERVAL,
      strategy: Bottleneck.strategy.LEAK,
    })

    try {
      this.client = await initUDPClient(
        this.incomming_port
      )
    } catch (e: any) {
      throw new AnidbError(RESPONSE_CODE.FAILED_TO_INITIALIZE, e.message)
    }

    // just save login
    if (user && password) {
      return this.login(user, password, encoding)
    }
  }

  /**
 * @private
 */
  _autoPing = () => {
    // ping only if session is active
    if (this.session) {
      // const pingCheckTime = Math.max(0, THIS.#PINGINTERVAL - (this.lastRequest || 0))
      const lastRequest = this.lastRequest || 0
      const now = Date.now()

      if (now > lastRequest + this.pingInterval) {
        log.debug(`executing ping. last:  ${ now - lastRequest }`)
        this.ping().then(this._autoPing).catch(e => {
          this.disconnect('autoPing', e)
        })
        return
      }

      // just to be sure we don't double schedule!
      clearTimeout(this.#pingTimer)
      log.debug(
        `scheduling ping in: ${ Math.max(lastRequest + this.pingInterval - now, 0) }`
      )
      this.#pingTimer = setTimeout(
        this._autoPing,
        Math.max(lastRequest + this.pingInterval - now, 0)
      )
    }
  }


  private _callApi = async (
    command: string,
    params?: Record< number | string, number | string>,
    expected_responses?: Array<string | number>,
    priority?: number
  ): Promise<ParsedResponse> => {
    const { client, requestQueue } = this

    try {
      // pointless to do anything if there is no client!
      if (!client) {
        throw new AnidbError(RESPONSE_CODE.NOT_CONNECTED)
      }

      // const _this = this

      log.debug(`Queuing ${ command }: "${ JSON.stringify(params) }"`)
      const response = (await requestQueue.schedule(
        { priority: priority || 5 },
        udpRequester,
        this,
        command,
        params
      )) as ParsedResponse

      // if expected_responses is set and it includes the response.code, return it
      if (
        expected_responses &&
        expected_responses.map(String).includes(String(response.code))
      ) {
        return response
      }

      if (response.code > 305) {
        // 305 is the first error
        throw new AnidbError(response.code as typeof RESPONSE_CODE[keyof typeof RESPONSE_CODE], response.data)
      }

      return response
    } catch (e) {
      // hacky, but what can I do?
      let error = (e || new AnidbError()) as Error

      if (error.name !== 'AnidbError') {
        if (
          error.toString() === 'Error: This job has been dropped by Bottleneck'
        ) {
          error = new AnidbError(RESPONSE_CODE.NOT_CONNECTED)
        } else if (error?.name === 'TimeoutError') {
          error = new AnidbError(RESPONSE_CODE.CONNECTION_TIMEOUT)
        } else {
          error = new AnidbError(RESPONSE_CODE.UNKNOWN_API_ERROR, error.message )
        }
      }

      // handle fatal errors!!
      if (
        error instanceof AnidbError &&
        FATAL_ERROR_CODES.includes(error.code as any)
      ) {
        // yap this was fatal!
        try {
          await this.disconnect(`_callApi.${ command }`, error)
        } catch (dc_err) {
          log.warn(`Could not properly disconnect after fatal error: ${ (dc_err as any).message }`) // shuld not happen and would be wierd if it would
        }
      }

      throw error
    } finally {
      // save date of the last response, failed requests do not really matter they were still requests! (what about timeout?)
      this.lastRequest = Date.now()
    }
  }

  /**
 *  To manually ping (the lib takes care of pinging every once in a while by it's own)
 * @category Connection Commands
 */
  ping () {
    return this._callApi(
      'PING',
      {
        nat: 1,
      },
      [ RESPONSE_CODE.PONG ]
    )
  }

  /**
   * log into Anidb
   * @category Connection Commands
   */
  async login (
    user: string,
    pass: string,
    encoding?: EncodingType
  ): Promise<{
    session: string;
    ip?: string | null | undefined;
    port?: string | null | undefined;
  }> {
    const { clientId, _callApi } = this
    const {
      LOGIN_ACCEPTED,
      LOGIN_ACCEPTED_NEW_VERSION,
      LOGIN_FAILED,
    } = RESPONSE_CODE

    let enc: typeof ENCODINGS[EncodingType] = ENCODINGS.UTF8

    if (encoding) {
      if (!ENCODINGS[encoding]) {
        throw new AnidbError(RESPONSE_CODE.ENCODING_NOT_SUPPORTED, `${ encoding } is not valid, must be one of: ${ Object.keys(ENCODINGS).join(', ') }`)
      }
      enc = ENCODINGS[encoding]
    }

    const resp = await _callApi(
      'AUTH',
      {
        user,
        pass,
        protover: PROT_VER,
        client: clientId,
        clientver: 1,
        comp: 1,
        enc,
      },
      [ LOGIN_ACCEPTED, LOGIN_ACCEPTED_NEW_VERSION, LOGIN_FAILED ]
    )

    if (resp.code === LOGIN_FAILED) {
      const error = new AnidbError(resp.code)
      this.disconnect('LOGIN_FAILED', error)
      throw error
    }

    const [ session, host ] = resp.response
    this.session = session

    // start pinging
    this._autoPing()

    // on login auto switch to default encoding!, set higher priority to skip already scheduled stuff....
    // TODO: use enc with auth
    // await this.encoding(null, 4)

    if (resp.response.length > 4) {
      const [ ip, port ] = host.split(':')
      return {
        session,
        ip,
        port,
      }
    } else {
      return {
        session,
      }
    }
  }
  /**
 * Disconnect and logout
 * @category Connection Commands
 */
  async disconnect (source?: any, error?: Error) {
    try {
      if (this.session && this.client) {
        // attempt raw logout
        // should just use priority and skip it all?
        await udpRequester(this, 'LOGOUT', {}) // await this.logout()
      }
    } finally {
      if (this.client) {
        this.requestQueue.stop({ dropWaitingJobs: true })
        clearTimeout(this.#pingTimer)
        await new Promise<void>((resolve) => {
          if (this.client) {
            this.client.close(() => {
              resolve()
            })
          }

          this.client = null
        })
        super.emit(AnidbUDPClient.EVENTS.DISCONNECT, { error, source })
        // emit disconnect
      }
    }
  }


  /**
   * Logs the user out. Only very few commands can be used when logged out, and this library will stop tying to keep the session alive when logged out.
   *
   * @param priority
   * @category Connection Commands
   */
  async logout (priority?: number) {
    const response = await this._callApi(
      'LOGOUT',
      {},
      [ RESPONSE_CODE.LOGGED_OUT, RESPONSE_CODE.NOT_LOGGED_IN ],
      priority
    )
    this.session = null

    if (response.code === RESPONSE_CODE.NOT_LOGGED_IN) {
      throw new AnidbError(response.code)
    }
  }

  /**
   * Change the encoding for future responses (reset on disconnect). Prefrably use the `enc` param of {@link AnidbUDPClient.login} instead.
   * @category Connection Commands
   * @deprecated Specify encoding with {@link AnidbUDPClient.login} or {@link AnidbUDPClient.connect} command
   */
  encoding = async (
    encoding?: EncodingType,
    priority?: number
  ) => {
    const name = encoding || 'UTF8'
    // ENCODING name={str encoding name}
    const response = await this._callApi(
      'ENCODING',
      {
        name,
      },
      [ RESPONSE_CODE.ENCODING_CHANGED, RESPONSE_CODE.ENCODING_NOT_SUPPORTED ],
      priority
    )

    if (response.code === RESPONSE_CODE.ENCODING_NOT_SUPPORTED) {
      throw new AnidbError(response.code)
    }
  }

  /**
   * Return anime by title or aid
   *
   * @example
   * ```ts
   * const { romanji_name, episodes, aid } = await anidb.anime(3211,["romanji_name", "episodes"])
   * ```
   *
   * @param anime Anime title (any synonim) or anime id (aid)
   * @param fields List of fields to to return.
   * @category Data Commands
   */
  anime<T extends keyof AnimeResult> (
    anime: number | string,
    fields?: Array<T>
  ): Promise<Pick<AnimeResult, T | 'aid'>> {
    const { _callApi } = this

    // // const api = this._api
    const amask = new AnimeParser(fields)
    const command = 'ANIME'
    return this.cache
      .get<Awaited<ReturnType<typeof this.anime>>>(
        command,
        anime,
        { validator: amask.verifyObject,
          onMiss: async (bad_result) => {
            const request = nameOrId(anime, 'aid', 'aname', {
              amask: amask.mask,
            })
            const response = await _callApi(command, request, [ RESPONSE_CODE.ANIME ])
            const { data } = response
            const resp_obj: Record<keyof AnimeResult, any> = amask.parseData(data)
            const result = { ...(bad_result || {}), ...resp_obj }
            return {
              id: result.aid,
              value: result,
              aliases: [
                result.romanji_name,
                result.kanji_name,
                result.english_name,
                ...result.other_name_list || [],
                ...result.short_name_list || [],
                ...result.synonym_list || [],
              ],
            }
          },
        })
  }

  /**
   * get anime description by aid
   * @category Data Commands
   */
  animeDesc (aid: number): NullablePromise<string> {

    const command = 'ANIMEDESC'
    const parser = new SimpleParser({
      'current_part': Number,
      'max_parts': Number,
      'desc': String,
    } as const)
    return this.cache.get(
      command,
      aid,
      {
        onMiss: async () => {
          const { data } = await this._callApi(command, {
            aid,
            part: 0,
          })
          const part_1 = parser.parseData(data)
          let other_parts = []
          const other_parts_promises = []

          for (let part = 1; part < part_1.max_parts; part++) {
            other_parts_promises.push(
              this._callApi(command, {
                aid,
                part,
              }).then(({ data }) => parser.parseData(data))
            )
          }

          other_parts = await Promise.all(other_parts_promises)
          const description = [ part_1, ...other_parts ].map((d) => d.desc).join('')
          return description
        },
      }
    )
  }

  /**
  * get calendar list
  * @category Data Commands
  */
  async calendar (): Promise<
    Array<{
      aid: number;
      startdate: number;
      dateflags: Array<string>;
    }>
    > {
    const command = 'CALENDAR'
    const { data } = await this._callApi(command, {})
    return ListField(
      MapFieldStatic({
        'aid': Number,
        'startdate': Number,
        'dateflags': Dateflags,
      }),
      '\n',
      true
    )(data)
  }

  /**
   * get character by character id
   * @category Data Commands
   */
  character (
    charid: number
  ) {
    const command = 'CHARACTER'
    const parser = new SimpleParser(
      {
        'charid': Number,
        'character_name_kanji': String,
        'character_name_transc': String,
        'pic': String,
        'anime_blocks': ListField(
          MapFieldStatic({
            'aid': Number,
            'appearance': Number, // should I parse this
            'creatorid': Number,
            'is_main_seiyuu': Boolean,
          } as const, ',' ),
          "'", true ),
        'episode_list': ListField(Number, ',', true),
        'last_update_date': String,
        'type': Number,
        'gender': String,
      } as const
    )
    return this.cache.get(
      command,
      charid,
      {
        onMiss: async () => {
          const { data } = await this._callApi(command, {
            charid,
          })
          return parser.parseData(data)
        },
      }
    )
  }

  /**
 * get creator by creator id
* @category Data Commands
 */
  creator (
    creatorid: number
  ) {
    const command = 'CREATOR'

    const parser = new SimpleParser({
      'creatorid': Number,
      'creator_name_kanji': String,
      'creator_name_transcription': String,
      'type': CodedField({
        '1': 'person',
        '2': 'company',
        '3': 'collaboration',
      } as const),
      'pic_name': String,
      'url_english': String,
      'url_japanese': String,
      'wiki_url_english': String,
      'wiki_url_japanese': String,
      'last_update_date': Number,
    } as const)

    return this.cache.get(
      command,
      creatorid,
      { onMiss: async () => {

        const { data } = await this._callApi(command, { creatorid })

        return parser.parseData(data)
      },
      }
    )
  }


  static #episodeParser = new SimpleParser({
    'eid': Number,
    'aid': Number,
    'length': Number,
    'rating': Number,
    'votes': Number,
    'epno': String,
    'eng': String,
    'romaji': String,
    'kanji': String,
    'aired': Number,
    'type': CodedField({
      '1': '',
      '2': 'S',
      '3': 'C',
      '4': 'T',
      '5': 'P',
      '6': 'O',
    } as const),
  }
  )

  /**
 * get episode by episode id
 * @category Data Commands
 */
  episode (
    eid: number
  ) {
    const command = 'EPISODE'

    return this.cache.get(
      command,
      eid,
      {
        onMiss: async () => {
          const { data } = await this._callApi(command, {
            eid,
          })
          return AnidbUDPClient.#episodeParser.parseData(data)
        },
      })
  }


  /**
   * get episode by anime and episode number
   * @param anime anime title or anime id (aid)
   * @param epno episode number
   * @category Data Commands
   */
  episode_by_anime (
    anime: string | number,
    epno: string
  ) {
    const command = 'EPISODE'
    return this.cache.get(
      command,
      `${ anime }:${ epno }`,
      {
        onMiss: async () => {
          const request = nameOrId(anime, 'aid', 'aname', {
            epno,
          })
          const { data } = await this._callApi(command, request)
          return AnidbUDPClient.#episodeParser.parseData(data)
          // using alias
          // const result = episodeParser.parseData(data)
          // return {
          //   id: result.aid + ':' + epno,
          //   value: result,
          //   aliases: [
          //     result.romaji,
          //     result.kanji,
          //     result.eng,
          //   ].map(a => `${ a }:${ epno }`),
          // }
        },
      }
    )
    // return this.cache.get(command, `${ anime }:${ epno }`).miss() as ReturnType<typeof this.episode_by_anime>
  }

  /**
   * Retrieve Group Data
   * @param group group id or name
   * @category Data Commands
   */
  group (
    group: number | string
  ) {
    const parser = new SimpleParser(
      {
        'gid': Number,
        'rating': Number,
        'votes': Number,
        'acount': Number,
        'fcount': Number,
        'name': String,
        'short': String,
        'irc_channel': String,
        'irc_server': String,
        'url': String,
        'picname': String,
        'foundeddate': Number,
        'disbandeddate': Number,
        'dateflags': Dateflags,
        'lastreleasedate': Number,
        'lastactivitydate': Number,
        'grouprelations': ListField(
          MapFieldStatic(
            {
              'othergroupid': Number,
              'relationtype': CodedField({
                '1': 'participant_in',
                '2': 'parent_of',
                '4': 'merged_from',
                '5': 'participant_in',
                '6': 'participant_in',
                '105': 'formerly',
              } as const),
            }
            , ',')
          ,'\''),
      } as const
    )
    const command = 'GROUP'
    return this.cache.get(
      command,
      group,
      {
        onMiss: async () => {
          const { data } = await this._callApi(
            command,
            nameOrId(group, 'gid', 'gname')
          )
          return parser.parseData(data)
        },
      })
  }

  /**
   * Returns a list of group names and ranges of episodes released by the group for a given anime.
   * @param aid anime id
   * @param state
   * @category Data Commands
   */
  async groupstatus (
    aid: number,
    state?:
      | 'ongoing'
      | 'stalled'
      | 'complete'
      | 'dropped'
      | 'finished'
      | 'specials_only'
  ) {
    const command = 'GROUPSTATUS'
    const request: Record<string, any> = {
      aid,
    }
    const stateCode = {
      '1': 'ongoing',
      '2': 'stalled',
      '3': 'complete',
      '4': 'dropped',
      '5': 'finished',
      '6': 'specials_only',
    } as const

    const stateCodeDecode = reverseObj(stateCode)

    if (state) {
      const state_coded = CodedField(stateCodeDecode)(state)
      if (state_coded) {
        request.state = state_coded
      }
    }

    // should I cache this?
    const { data } = await this._callApi(command, request)
    return ListField(
      MapFieldStatic({

        'gid': Number,
        'group_name': String,
        'completition_state': CodedField(stateCode),
        'last_episode_number': Number,
        'rating': Number,
        'votes': Number ,
        'episode_range': String,
      }),
      '\n',
      true
    )(data)
  }

  /**
 * Retrieve File Data by file id
 * @param fid
 * @param fields list of fields to return
 * @category Data Commands
 */
  file<T extends keyof FileResult> (
    fid: number,
    fields: Array<T> // opt in anime
  ): Promise<Pick<FileResult, T | 'fid'>> {
    const command = 'FILE'
    const fmask = new FileParser(fields)
    return this.cache
      .get<Awaited<ReturnType<typeof this.file>>>(
        command,
        fid,
        {
          validator: fmask.verifyObject,
          onMiss: async (partial_result) => {
            const response = await this._callApi(command, {
              fid,
              fmask: fmask.getFmask(),
              amask: fmask.getAmask(),
            })
            const { data } = response
            const resp_obj: Record<keyof FileResult, any> = fmask.parseData(data)
            return { ...partial_result || {}, ...resp_obj }
          },
        })
  }

  /**
   * Retrieve File Data by ed2k and size
   * @param ed2k file ed2k hash
   * @param size size of file in bytes
   * @param fields list of fields to return
   * @category Data Commands
   */
  file_by_hash<T extends keyof FileResult> (
    ed2k: string,
    size: number,
    fields: Array<T>
  ): Promise<Pick<FileResult, T | 'fid'>> {
    const command = 'FILE'
    const fmask = new FileParser(fields)
    const cache_id = `s${ size }|h${ ed2k }`
    return this.cache
      .get<Awaited<ReturnType<typeof this.file>>>(
        command,
        `s${ size }|h${ ed2k }`,
        {
          validator: fmask.verifyObject,
          onMiss: async (partial_result) => {
            const response = await this._callApi(command, {
              ed2k,
              size,
              fmask: fmask.getFmask(),
              amask: fmask.getAmask(),
            })
            const { data } = response
            const resp_obj: Record<keyof FileResult, any> = fmask.parseData(data)
            const result = { ...partial_result || {}, ...resp_obj }
            return {
              id: result.fid,
              value: result,
              aliases: [ cache_id ],
            }
          },
        }
      )
  }

  /**
   * Retrieve File Data by anime, group and episode number
   * @param anime anime name or id
   * @param group group name or id
   * @param epno episode number
   * @param fields fields to return
   *
   * @throws {@link AnidbError} with code {@link RESPONSE_CODE}.MULTIPLE_FILES_FOUND if more than one file is found. List of file ids will be in `error.payload`
   * @category Data Commands
   */
  file_by_episode<T extends keyof FileResult> (
    anime: number | string,
    group: number | string,
    epno: string,
    fields: Array<T>
  ): Promise<Pick<FileResult, T | 'fid'>> {
    const command = 'FILE'
    // const api = this
    const fmask = new FileParser(fields)
    const cache_id = `a${ anime }|g${ group }|e${ epno }`
    let request: Record<string, any> = {
      epno,
      fmask: fmask.getFmask(),
      amask: fmask.getAmask(),
    }
    request = nameOrId(anime, 'aid', 'aname', request)
    request = nameOrId(group, 'gid', 'gname', request)
    return this.cache
      .get<Awaited<ReturnType<typeof this.file>>>(
        command,
        cache_id,
        {
          validator: fmask.verifyObject,
          onMiss: async (partial_result) => {
            const response = await this._callApi(command, request, [
              RESPONSE_CODE.MULTIPLE_FILES_FOUND,
            ])
            const { data, code } = response

            if (code === RESPONSE_CODE.MULTIPLE_FILES_FOUND) {
              const fileLists = ListField(Number, '|', true)(data)
              throw new AnidbError(
                code,
                `Multiple files found ${ fileLists.join(', ') }`,
                fileLists
              )
            } else {
              const resp_obj: Record<keyof FileResult, any> = fmask.parseData(data)
              const result = { ...partial_result || {}, ...resp_obj }
              return {
                id: result.fid,
                value: result,
                aliases: [ cache_id ],
              }
            }
          },
        }
      )

  }


  /**
   * Returns a list of AniDB anime ids of anime that have been updated in in a given time frame, ordered by descending age (oldest to newest change).
   * Either age is specified or time not both.
   * @param opts.age age in days
   * @param opts.time unix time
   * @category Data Commands
   *
   */
  async updated (
    opts: {
      /** age in */
      age: number
    } | { time: number }
  ) {

    // @ts-expect-error - runtime check
    if (opts.age && opts.time) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `either pass age or time but never both`)
    }


    const command = 'UPDATED'
    const { data } = await this._callApi(command, { entity: 1, ...opts })
    const parser = new SimpleParser({
      'entity': Number,
      'total_count': Number,
      'last_update_date': Number,
      'updated_aids': ListField(Number, ',', true),
    })
    const { entity: _entity, ...rest } = parser.parseData(data)
    return rest

  }

  static #mylist_parser = new SimpleParser({
    'lid': Number,
    'fid': Number,
    'eid': Number,
    'aid': Number,
    'gid': Number,
    'date': Number,
    'state': CodedField(MylistStates),
    'viewdate': Number,
    'storage': String,
    'source': String,
    'other': StringWithLineBreaks,
    'filestate': CodedField({
      '0': 'normal/original',
      '1': 'corrupted version/invalid crc',
      '2': 'self edited',
      '10': 'self ripped',
      '11': 'on dvd',
      '12': 'on vhs',
      '13': 'on tv',
      '14': 'in theaters',
      '15': 'streamed',
      '100': 'other',
    } as const),
  }
  )
  /**
   *
   * @param lid Retrieve MyList Data
   * @returns
   * @category My List Commands
   */
  async mylist_by_id (
    lid: number,
  ) {
    const { data } = await this._callApi('MYLIST', { lid })
    return AnidbUDPClient.#mylist_parser.parseData(data)
  }

  /**
   * Retrieve MyList entry by file id
   * @param fid file id
   * @category My List Commands
   */
  async mylist_by_file_id (
    fid: number,
  ) {
    const { data } = await this._callApi('MYLIST', { fid })
    return AnidbUDPClient.#mylist_parser.parseData(data)
  }

  /**
   * Retrieve MyList entry by file ed2khash and size
   * @param ed2k hash
   * @param size in bytes
   * @category My List Commands
   */
  async mylist_by_file_hash (
    ed2k: string,
    size: number
  ) {
    const { data } = await this._callApi('MYLIST', { ed2k, size })
    return AnidbUDPClient.#mylist_parser.parseData(data)
  }

  /**
   * Retrieve MyList entry by anime. Can return either a single result `{ single: ... }` or muliple result `{ multi: ... }`. See type definition.
   * @param anime anime name or id
   * @param group group name or id
   * @param epno episode number
   * @category My List Commands
   */
  async mylist_by_anime (
    anime: number | string,
    group?: number | string,
    epno?: number,
  )
  {
    const command = 'MYLIST'

    let request: Record<string, any> = { }

    if (epno) {
      request['epno'] = epno
    }

    request = nameOrId(anime, 'aid', 'aname', request)
    if (group) {
      request = nameOrId(group, 'gid', 'gname', request)
    }

    const { data, code } = await this._callApi(command, { ...request }, [ RESPONSE_CODE.MYLIST, RESPONSE_CODE.MULTIPLE_MYLIST_ENTRIES ])
    // const { data, code } = {
    //   data: 'Aa! Megami-sama! (2005)|24||||1-24,S1-S3,C1-C2,T1,T25|1-24,S1-S3,C1-C2,T1,T25|SM_LoC|T25|AonE-AnY|1-24,S1-S3,T1|Clean|C1-C2',
    //   code: 312,
    // }

    if (code === RESPONSE_CODE.MYLIST) {
      const value = AnidbUDPClient.#mylist_parser.parseData(data)
      return { single: value }
    } else if (code === RESPONSE_CODE.MULTIPLE_MYLIST_ENTRIES) { // because fuck consistency amirite?
      const staticFieldsDefinition = {
        'anime_title': String,
        'episodes': Number,
        'eps_unkown': String,
        'eps_hdd': String,
        'eps_cd': String,
        'eps_deleted': String,
        'eps_watiched': String,
      } as const
      const staticFieldsNr = Object.keys(staticFieldsDefinition).length

      const splited = data.split('|')
      const staticFields = MapFieldStatic(staticFieldsDefinition)(splited.slice(0, staticFieldsNr).join('|'))

      const groupsPart = splited.slice(staticFieldsNr)
      const groups: Array<{group: string, episodes: string}> = []
      for (let i = 0; i < groupsPart.length; i += 2) {
        groups.push({ group: groupsPart[i], episodes: groupsPart[i + 1] })
      }
      const result = { ...staticFields, groups }
      return { multi: result }
    }
  }

  /**
   * Add MyList entry by file. Either by file id, ed2k+size, mylist id. Can be used to update and exiting entry by passing `options.edit=true`
   * @param fileinfo file to add to mylist, pass `{ fid }` (file id) or `{ ed2k, size }` (ed2k hash and size in bytes) or `{ lid }` (mylist id) to edit
   * @param options My list entry options
   * @category My List Commands
   * @throws {@link AnidbError} with code {@link RESPONSE_CODE}.FILE_ALREADY_IN_MYLIST if not `edit=true`. Mylist entry (same result as {@link AnidbUDPClient.mylist_by_file_id | mylist_by_file_id result}) will be in `error.payload`
   */
  async mylist_add_by_file (
    fileinfo: ({ fid: number } | { ed2k: string, size: number, } | { lid: number }),
    options?: {
      /** `true` to edit a MyList entry instead of creating a new one. When editing, optional values that are not supplied retain their original value. That is, they are not replaced with default or empty values. Only values supplied are updated. When `lid` is passed is automattically set to true and option ignored */
      edit?: boolean,
      state?: typeof MylistStates[keyof typeof MylistStates],
      viewed?: boolean,
      viewdate?: number,
      /** (i.e. ed2k, dc, ftp, irc, ...) */
      source?: string,
      /** label of  the storage */
      storage?: string
      /** other remarks/notes (`<br/>` can be used to split into multiple lines) */
      other?: string
    }
  ): Promise<{code: 'MYLIST_ENTRY_ADDED', lid: number } | {code: 'MYLIST_ENTRY_EDITED', nr_edited: number} | undefined> {
    const command = 'MYLISTADD'

    // validate input
    const request: Record<string, string | number> = {}
    if ('fid' in fileinfo) {
      request['fid'] = fileinfo.fid
    } else if ('ed2k' in fileinfo && 'size' in fileinfo) {
      request['ed2k'] = fileinfo.ed2k
      request['size'] = fileinfo.size
    } else if ('lid' in fileinfo) {
      request['lid'] = fileinfo.lid
      request['edit'] = 1
      if (options && 'edit' in options && !options.edit) {
        throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `when passing my list id, options.edit must be set to true`)
      }
    } else {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `fileinfo must be one of { fid: number } { ed2k: string, size: number } or { lid: number }`)
    }

    if (options && typeof options == 'object') {
      for (const [ label, value ] of Object.entries(options)) {
        switch (label) {
        case 'viewed':
        case 'edit':{
          request[label] = value ? 1 : 0
          break
        }
        case 'state': {
          request[label] = CodedField(reverseObj(MylistStates))(value as typeof MylistStates[keyof typeof MylistStates])
          break
        }
        default: {
          request[label] = value as string
        }
        }
      }


      const { data, code } = await this._callApi(command, { ...request }, [ RESPONSE_CODE.MYLIST_ENTRY_ADDED, RESPONSE_CODE.FILE_ALREADY_IN_MYLIST, RESPONSE_CODE.MYLIST_ENTRY_EDITED ])

      // return data
      switch (code) {
      case RESPONSE_CODE.MYLIST_ENTRY_ADDED:{
        return { code: 'MYLIST_ENTRY_ADDED', lid: Number(data) } as const
      }
      case RESPONSE_CODE.MYLIST_ENTRY_EDITED: {
        return { code: 'MYLIST_ENTRY_EDITED', nr_edited: Number(data) }
      }
      case RESPONSE_CODE.FILE_ALREADY_IN_MYLIST:{
        const result = AnidbUDPClient.#mylist_parser.parseData(data)
        throw new AnidbError(RESPONSE_CODE.FILE_ALREADY_IN_MYLIST, `File ${ JSON.stringify(fileinfo) } already in mylist, pass edit=true to edit`,result)
      }
      default:{
        throw new AnidbError(RESPONSE_CODE.UNKNOWN_API_ERROR, `Unkown response code returned ${ code }`)
      }
      }
    }

  }

  /**
   * Add MyList entry by anime. Can be used to update and exiting entry by passing `options.edit=true`
   * @param animeinfo.anime anime name or id
   * @param animeinfo.group group name or id. Optional: if not defined generic file will be added to mylist
   * @param animeinfo.epno Episode number, epno=0 means all episodes (default), negative numbers means upto. (-12 -> upto 12)
   * @param options My list entry options
   *
   * @category My List Commands
   * @throws {@link AnidbError} see codes at  {@link https://wiki.anidb.net/UDP_API_Definition#MYLISTADD:_Add_file_to_MyList | Add_file_to_MyList }
   */
  async mylist_add_by_anime (

    animeinfo: { anime: string | number, group?: string | number, epno?: number },
    options?: {
        /** `true` to edit a MyList entry instead of creating a new one. When editing, optional values that are not supplied retain their original value. That is, they are not replaced with default or empty values. Only values supplied are updated. */
        edit?: boolean,
        state?: typeof MylistStates[keyof typeof MylistStates],
        viewed?: boolean,
        viewdate?: number,
        /** (i.e. ed2k, dc, ftp, irc, ...) */
        source?: string,
        /** label of  the storage */
        storage?: string
        /** other remarks/notes (`<br/>` can be used to split into multiple lines) */
        other?: string
      }
  ) {
    // validate first
    if (!animeinfo || !animeinfo.anime || (animeinfo.epno && !Number.isInteger(animeinfo.epno))) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `Invalid first argument: animeinfo.anime property and animeinfo.epno properties are required`)
    }
    let request: Record<string, string | number> = { }
    request = nameOrId(animeinfo.anime,'aid','aname',request)
    if ('group' in animeinfo) {
      request = nameOrId(animeinfo.group,'gid','gname',request)
    } else {
      request['generic'] = 1
    }

    if (animeinfo.epno) {
      request['epno'] = Number(animeinfo.epno)
    } else {
      request['epno'] = 0
    }


    if (options && typeof options == 'object') {
      for (const [ label, value ] of Object.entries(options)) {
        switch (label) {
        case 'viewed':
        case 'edit':{
          request[label] = value ? 1 : 0
          break
        }
        case 'state': {
          request[label] = CodedField(reverseObj(MylistStates))(value as typeof MylistStates[keyof typeof MylistStates])
          break
        }
        default: {
          request[label] = value as string
        }
        }
      }
    }

    const { data } = await this._callApi('MYLISTADD', { ...request }, [ RESPONSE_CODE.MYLIST_ENTRY_ADDED ])
    return { added: Number(data) }
  }


  /**
   * Removes MyList entry by file. Either by file id, ed2k+size, mylist id.
   * @param fileinfo file to add to mylist, pass `{ fid }` (file id) or `{ ed2k, size }` (ed2k hash and size in bytes) or `{ lid }` (mylist id) to edit
   * @category My List Commands
   * @throws {@link AnidbError} with code {@link RESPONSE_CODE}.FILE_ALREADY_IN_MYLIST if not `edit=true`. Mylist entry (same result as {@link AnidbUDPClient.mylist_by_file_id | mylist_by_file_id result}) will be in `error.payload`
   * @throws {@link AnidbError} see codes at {@link https://wiki.anidb.net/UDP_API_Definition#MYLISTADD:_Add_file_to_MyList | Add_file_to_MyList }
   */
  async mylist_del_by_file (
    fileinfo: ({ fid: number } | { ed2k: string, size: number, } | { lid: number }),
  ) {

    // validate input
    const request: Record<string, string | number> = {}
    if ('fid' in fileinfo) {
      request['fid'] = fileinfo.fid
    } else if ('ed2k' in fileinfo && 'size' in fileinfo) {
      request['ed2k'] = fileinfo.ed2k
      request['size'] = fileinfo.size
    } else if ('lid' in fileinfo) {
      request['lid'] = fileinfo.lid
    } else {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `fileinfo must be one of { fid: number } { ed2k: string, size: number } or { lid: number }`)
    }

    const { data } = await this._callApi('MYLISTDEL', { ...request }, [ RESPONSE_CODE.MYLIST_ENTRY_ADDED ])
    return { removed: Number(data) }
  }

  /**
   * Remove MyList entries by anime.
   * @param animeinfo.anime anime name or id
   * @param animeinfo.group group name or id. Optional
   * @param animeinfo.epno Episode number (negative numbers and 0 do not work), and epno is required
   *
   * @category My List Commands
   * @throws {@link AnidbError} see codes at {@link https://wiki.anidb.net/UDP_API_Definition#MYLISTADD:_Add_file_to_MyList | Add_file_to_MyList}
   */
  async mylist_del_by_anime (

    animeinfo: { anime: string | number, group?: string | number, epno: number },
  ) {

    if (!animeinfo || !animeinfo.anime || (!animeinfo.epno && animeinfo.epno !== 0) || !Number.isInteger(animeinfo.epno)) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `Invalid first argument: animeinfo.anime property and animeinfo.epno properties are required`)
    }
    let request: Record<string, string | number> = { }
    request = nameOrId(animeinfo.anime,'aid','aname',request)
    if ('group' in animeinfo) {
      request = nameOrId(animeinfo.group,'gid','gname',request)
    }

    if (animeinfo.epno || animeinfo.epno === 0) {
      request['epno'] = Number(animeinfo.epno)
    }

    const { data } = await this._callApi('MYLISTDEL', { ...request }, [ RESPONSE_CODE.MYLIST_ENTRY_ADDED ])
    return { removed: Number(data) }
  }

  /**
   *  Retrieve MyList stats
   * @category My List Commands
   */
  async mylist_stats () {
    const parser = new SimpleParser({
      anime: String,
      eps: String,
      files: String,
      size_of_files: String,
      added_animes: String,
      added_eps: String,
      added_files: String,
      added_groups: String,
      leech_perc: String,
      glory_perc: String,
      viewed_perc: String,
      mylist_perc: String,
      viewed_mylist_perc: String,
      viewed_nr_eps: String,
      votes: String,
      reviews: String,
      views_in_min: String,
    })
    const { data } = await this._callApi('MYLISTSTATS',{})
    return parser.parseData(data)
  }


  private static vote_types = { 'anime': '1', 'anime_tmp': '2', 'group': '3', 'episode': '6' } as const

  /**
   * Vote for specified anime/episode/group
   * @throws {@link AnidbError} with code {@link RESPONSE_CODE}.NO_SUCH_VOTE, PERMVOTE_NOT_ALLOWED, ALREADY_PERMVOTED with payload same as the normal response
   * @throws {@link AnidbError} see codes at {@link https://wiki.anidb.net/UDP_API_Definition#VOTE:_Vote_for_specified_anime/episode/group | Vote_for_specified_anime/episode/group}
   * @category My List Commands
   */
  async vote (
    /** type of vote: anime vote, anime temporary vote, vote for a group, vote for episode */
    type: keyof typeof VOTE_TYPES,
    /** identifier to vote for, can be a name or the id (of the type provided) */
    name_or_id: string | number,
    /** Must be 'get' or 'revoke' or a number between 100 and 1000 */
    vote: 'get' | 'revoke' | number
  ) {
    if (!(type in VOTE_TYPES)) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED,`type: ${ type } must be one of ${ Object.keys(AnidbUDPClient.vote_types).join(', ') }`)
    }

    let request: Record<string, string | number> = {
      type: CodedField(VOTE_TYPES)(type),
    }

    request = nameOrId(name_or_id,'id','name', request)

    if (vote === 'get' || !vote) {
      request.value = 0
    } else if ( vote === 'revoke') {
      request.value = -1
    } else if ( Number.isInteger(vote) && vote >= 100 && vote <= 1000) {
      request.value = vote
    } else {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED,`vote (${ vote }) must must be 'get' or 'revoke' or a number between 100 and 1000 `)
    }

    const actions = {
      [RESPONSE_CODE.VOTED]: 'VOTED',
      [RESPONSE_CODE.VOTE_FOUND]: 'VOTE_FOUND',
      [RESPONSE_CODE.VOTE_REVOKED]: 'VOTE_REVOKED',
      [RESPONSE_CODE.VOTE_UPDATED]: 'VOTE_UPDATED',
    } as const

    const responseParser = new SimpleParser({
      'name': String,
      'vote_value': Number,
      'type': CodedField(reverseObj(VOTE_TYPES)),
      'id': Number,
    })

    try {
      const response = await this._callApi('VOTE', request, Object.keys(actions))
      const actionCode = response.code as keyof typeof actions

      return {
        action: actions[actionCode],
        code: actionCode,
        ...responseParser.parseData(response.data),
      }

    } catch (e) {
      if (e instanceof AnidbError) {
        switch (e.code) {
        case RESPONSE_CODE.NO_SUCH_VOTE:
        case RESPONSE_CODE.PERMVOTE_NOT_ALLOWED:
        case RESPONSE_CODE.ALREADY_PERMVOTED:{
          e.payload = {
            code: e.code,
            ...responseParser.parseData(e.message),
          }
          throw e
        }
        default:
          throw e
        }
      } else {
        throw e
      }
    }
  }

  /**
   * Get a random anime
   * @category Misc commands
   */
  async random (
    type: 'db' | 'watched' | 'unwatched' | 'mylist'
  ) {
    const types = {
      'db': 0,
      'watched': 1,
      'unwatched': 2,
      'mylist': 3,
    }
    if (!(type in types)) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED,`${ type } not a valid type, must be one of: ${ Object.keys(types).join(', ') }`)
    }

    const { data } = await this._callApi('RANDOMANIME', { type: types[type] })
    const fields = {
      'aid': String,
      'episodes': Number,
      'highest_ep_number': Number,
      'special_ep_count': Number,
      'rating': Number,
      'vote_count': Number,
      'temp_rating': Number,
      'temp_vote_count': Number,
      'average_review_rating': Number,
      'review_count': Number,
      'year': String,
      'type': String,
      'romanji_name': String,
      'kanji_name': String,
      'english_name': String,
      'other_name_list': ListField(String, undefined, true),
      'short_name_list': ListField(String, undefined, true),
      'synonym_list': ListField(String, undefined, true),
      'categories': ListField(String, ',', true),
      'air_date': Number,
      'end_date': Number,
      'dateflags': Dateflags,
      'is_18_restricted': NumBoolean,
      'picname': String,
    } as const

    const parser = new SimpleParser(fields)

    const parsedData = parser.parseData(data)
    return parsedData
  }

  /**
   * Queues a MyList Export by the AniDB Servers. As with a manual export request, exports are only done during periods when server load is low. As a result, exports may take up to 24 hours.
   * The client submitting the request will receive an AniDB message when the export is ready to be collected.
   * Only one export can be in the queue at a time.
   * @category Misc commands
   */
  async request_mylist_export (
    template: typeof EXPORT_TEMPLATES[number]
  ) {
    if (!EXPORT_TEMPLATES.includes(template)) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `${ template } is not a valid template. Must be one of: ${ EXPORT_TEMPLATES.join(', ') }`)
    }
    await this._callApi('MYLISTEXPORT', { template }, [ RESPONSE_CODE.EXPORT_QUEUED ])

    return 'EXPORT_QUEUED' as const
  }

  /**
   * Will cancel any pending export request, queued either through UDP or the web server.
   * @category Misc commands
   */
  async cancel_mylist_export () {
    await this._callApi('MYLISTEXPORT', { cancel: 1 }, [ RESPONSE_CODE.EXPORT_CANCELLED ])

    return 'EXPORT_CANCELLED' as const
  }

  /**
   * Retrieve Server Uptime
   * @category Misc commands
   */
  async uptime () {
    const { data } = await this._callApi('UPTIME',{}, [ RESPONSE_CODE.UPTIME ])
    return Number(data)
  }

  /**
   * Send Message
   * @category Misc commands
   */
  async send_message (
    username: string,
    title: string,
    body: string,
  ) {

    if (!username || typeof username !== 'string' || !title || typeof title !== 'string' || !body || typeof body !== 'string') {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, 'Fields username, title, and body are required and must be a string')
    }
    if (title.length > 50) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `title must be shorter than 50 characters but was ${ title.length }`)
    }
    if (body.length > 900) {
      throw new AnidbError(RESPONSE_CODE.ILLEGAL_INPUT_OR_ACCESS_DENIED, `body must be shorter than 900 characters but was ${ title.length }`)
    }

    await this._callApi('SENDMSG', { username, body, title })

    return 'SENDMESSAGE_SUCCESSFUL'
  }

  /**
   * Get user id
   * @category Misc commands
   */
  get_user_id ( username: string ): Promise<{ uid: number, username: string }>
  get_user_id ( uid: number ): Promise<{ uid: number, username: string }>
  async get_user_id ( username_or_uid: string | number): Promise<{ uid: number, username: string }> {

    const request = nameOrId(username_or_uid, 'uid', 'user', {})

    const { data } = await this._callApi('USER', request)
    const parser = new SimpleParser({ uid: Number, username: String })
    return parser.parseData(data)
  }
}