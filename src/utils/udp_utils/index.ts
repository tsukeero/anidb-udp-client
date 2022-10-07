import dgram from 'dgram'
import log from '../../utils/log'
import qs from 'querystring'
const ANIDB_API = 'api.anidb.net'
const ANIDB_PORT = 9000
import nodeUtil from 'util'
import fs from 'fs'
import makeid from './makeid'
// for dev purposes
const { SAVE_RESPONSES } = process.env
import { encrypt, decrypt } from './encryption'
import type { AnidbUDPClient } from '../../AnidbUDPClient'
export { createKey } from './encryption'
import { decompress } from './compression'
const TIMEOUT = 30000

function saveResponse (code: string | number, response: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filePath = require('path').resolve(__dirname, '../../../response_samples', String(code) )
  fs.writeFileSync(filePath, response)
}

export type ParsedResponse = {
  code: number;
  response: Array<string>;
  data: string;
};
export function parseResponse (resp: string): ParsedResponse {
  const parse_regex = /(^[0-9]{3})\s(.+)(?:\n((?:.|\n)+))?/m
  const matched = (new String(resp) || '').match(parse_regex)

  if (!matched) {
    log.debug('failed to parse: ', new String(resp))
    throw new Error('BAD_RESPONSE')
  }

  log.debug(new String(resp))
  return {
    code: Number(matched[1]),
    response: matched[2].trim().split(' '),
    data: (matched[3] || '').trim(),
  }
}


export function encodeRequest (command: string, params: qs.ParsedUrlQueryInput): string {
  const paramsString = Object.entries(params).map(([ key, value ]) => {

    const escapedValue = String(value).replaceAll(/\r\n|\r|\n/ig, '<br />').replaceAll(/&/ig,'&amp;')
    return `${ key }=${ escapedValue }`

  }).join('&')
  return command + ' ' + paramsString
}

export async function initUDPClient (port: undefined | number) {
  const client = dgram.createSocket('udp4')

  try {
    // random port?
    await nodeUtil.promisify(client.bind as (options: dgram.BindOptions, callback?: () => void) => dgram.Socket ).call(client, {
      port,
    })
    return client
  } catch (e) {
    await client.close()
    throw e
  }
}

// TODO: client on error = handle disconnect etc
type RequestObj = Record<string|number, string | number>
export function UDPRequest (_this: AnidbUDPClient, command: string, request: RequestObj | undefined | null): Promise<ParsedResponse> {
  const {
    client,
    session,
    encryption_key,
  } = _this // should be just client?

  // prep params
  const tag = makeid(5)
  const request_params = request ? {
    ...request,
    tag,
  } as RequestObj : {} as RequestObj

  if (session) {
    request_params.s = session
  }

  // todo: generate tag, and only expect tag
  const send_buffer = Buffer.from(encodeRequest(command, request_params))
  let lastResp = {}
  return new Promise((resolve: (response: ParsedResponse) => void, reject: (error: Error ) => void) => {

    if (!client) {
      return reject(new Error('No active client'))
    }

    const _client = client

    const timeoutHandler = setTimeout(() => {
      _client.removeListener('message', handleResponse)
      reject(new Error('Timeout'))
    }, TIMEOUT)

    const cleanResolve = (response: ParsedResponse) => {
      clearTimeout(timeoutHandler)
      resolve(response)
    }

    // TODO: handle global responses!
    async function handleResponse (response: any) {
      try {
        let respDecodedBuffer = Buffer.from(response) // = respBuffer

        if (encryption_key) {
          try {
            respDecodedBuffer = decrypt(respDecodedBuffer, encryption_key)
          } catch (e: any) {
            // most likely something went wrong on the anidb side, so encryption is now disabled
            _this.encryption_key = null
            log.debug(`Decription failed raw response was: ${ respDecodedBuffer }`)
            // throw error, will result in a fatal error disconnecting from anidb (logout etc)
            throw new Error(`Message decrypt failed: ${ e.message }`)
          }
        }


        if (respDecodedBuffer[0] === 0 && respDecodedBuffer[1] === 0) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const filePath = require('path').resolve(__dirname, '../../compressedResult')
          console.log(filePath)
          fs.writeFileSync(filePath, respDecodedBuffer.toString('base64'))

          respDecodedBuffer = await decompress(respDecodedBuffer)
        }

        const str_response = String(respDecodedBuffer)

        // ignore things that are not correctly tagged
        if (!str_response.startsWith(tag)) {
          return
        }

        const parsed_response = parseResponse(str_response.substr(6))
        if (SAVE_RESPONSES) {
          saveResponse(parsed_response.code, str_response)
        }
        lastResp = parsed_response

        // if (expected_responses.includes(parsed_response.code)) {
        _client.removeListener('message', handleResponse)

        return cleanResolve(parsed_response)
      } catch (e) {
        clearTimeout(timeoutHandler)
        _client.removeListener('message', handleResponse)

        return reject(e as Error)
      }
    }

    function handleError (err: Error) {
      _client.removeListener('message', handleResponse)
      clearTimeout(timeoutHandler)

      // remove all listeners
      // disconnect and shite...
      reject(err)
    }

    // prep events
    _client.once('error', handleError) // handle disconnect?


    _client.once('close', handleError) // handle disconnect?


    _client.on('message', handleResponse)

    log.debug(`Sending out request "${ String(send_buffer) }"`)
    let raw_send_buffer = send_buffer
    if (encryption_key) {
      raw_send_buffer = encrypt(send_buffer, encryption_key)
    }
    _client.send(raw_send_buffer, 0, raw_send_buffer.length, ANIDB_PORT, ANIDB_API)
  }).catch((e: Error) => {
    log.debug('LASTREP', JSON.stringify(lastResp))
    throw e
  })
}
/*
on(event,fn)=>{
  if(event == x){
    _client.on("message", udp_utils.push_handler)
  }else{
    super.on
  }
}
export function fakeUDPRequest (_this, command, request ) { // eslint-disable-line no-unused-vars
    // /send_buffer.toString().match(/([A-Z]+)/)
    const { session } = _this // should be just client?
    const request_params = request ? { ...request } : {}
    if (session) {
        request_params.s = session
    }
    const send_buffer = new Buffer(encodeRequest(command, request_params))
    log.debug(`Sending out request "${ String(send_buffer) }"`)
    return new Promise(resolve => {

        // @ts-expect-error
        const command = (String(send_buffer)).match(/[A-Z]+/)[0]
        switch (command) {
        case 'AUTH':
            return resolve({
                code: RESPONSE_CODE.LOGIN_ACCEPTED, // RESPONSE_CODE.LOGIN_FAILED
                response: [ 'FAKE', 'LOGIN', 'ACCEPTED' ],
                data: undefined,
            })
        case 'PING': return resolve({
            code: RESPONSE_CODE.PONG,
            response: [ 'PONG' ],
            data: '41234',
        })
        case 'LOGOUT':
            return resolve({
                code: RESPONSE_CODE.LOGGED_OUT, // '203',
                response: [ 'LOGGED', 'OUT' ],
                data: undefined,
            })
        case 'FILE':
            return resolve({
                code: 220,
                response: [ 'FILE' ],
                data: '312498||1||Vorbis (Ogg Vorbis)|104|||||TV Series|10795\'3440|1\'2|Contemporary Fantasy,Game,Fantasy World,Parallel Universe,Super Power,Present,Plot Continuity,Mahou Shoujo,Fantasy,Magic,Seinen,Sci-Fi,Human Enhancement,Action,Erotic Game,Cyborgs,Military,Shipboard,Other Planet,Humanoid Alien,Mecha,Calling Your Attacks,Dragon,Henshin,Shower Scene,Inline Skating,Magic Circles,Nudity,Juujin|mglnss\'NanohaSS\'StrikerS\'nanoha3\'nanoha strikers\'mslnss\'mslns|Magical Girl Lyrical Nanoha StrikerS\'Garota Mágica Lírica Nanoha StrikerS\'魔魔法法少少女女奈奈叶叶SS\n',
            })
        case 'EPISODE':
            return resolve({
                code: 240,
                response: [ 'EPISODE' ],
                data: '36156|2446|30|0|0|01|Volume 1|||924825600|1\n',
            })
        case 'ENCODING':
            return resolve({
                code: RESPONSE_CODE.ENCODING_CHANGED, // '203',
                response: [ 'ENCODING', 'CHANGED' ],
                data: undefined,
            })
         // No Default
        }
    }).timeout(TIMEOUT)
} */