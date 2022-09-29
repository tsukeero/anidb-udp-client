import dgram from 'dgram'
import log from '../utils/log'
import qs from 'querystring'
const ANIDB_API = 'api.anidb.net'
const ANIDB_PORT = 9000
import nodeUtil from 'util'
import fs from 'fs'
import makeid from '../utils/makeid'
import zlib from 'node:zlib'
// for dev purposes
const { SAVE_RESPONSES } = process.env

import type { AnidbUDPClient } from '../AnidbUDPClient'
const TIMEOUT = 30000


// TODO:improve maybe?
const decompress = (buffer: Buffer) => new Promise((resolve, reject) => {
  const buffer_builder: Buffer[] = []
  const decompress_stream = zlib.createUnzip()
    .on('data', (chunk: Buffer) => {
      buffer_builder.push(chunk)
    }).on('close', () => {
      resolve(Buffer.concat(buffer_builder))
    }).on('error', (err: any) => {
      if (err.errno !== -5) // EOF: expected
        reject(err)
    })

  decompress_stream.write(buffer.subarray(2))
  decompress_stream.end()
})


function saveResponse (code: string | number, response: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const filePath = require('path').resolve(__dirname, '../../response_samples', String(code) )
  fs.writeFileSync(filePath, response)
}

export type ParsedResponse = {
  code: number;
  response: Array<string>;
  data: string;
};
export function parseResponse (resp: string): ParsedResponse {
  // /const parse_regex = /(^[0-9]{3})\s(.+)(?:\n(.+)\n)?/m
  // better regex = (^[0-9]{3})\s(.+)(?:\n((?:.|\n)+)\n)?
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
  return command + ' ' + paramsString// qs.stringify(params)
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
        const respBuffer = Buffer.from(response)
        let respString
        if (respBuffer[0] === 0 && respBuffer[1] === 0) {
          respString = await decompress(respBuffer)
        } else {
          respString = String(respBuffer)
        }
        // ignore things that are not correctly tagged
        const str_response = String(respString)

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
        /* }  else {
            throw new AnidbError(parsed_response.code)
        } */
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

    _client.send(send_buffer, 0, send_buffer.length, ANIDB_PORT, ANIDB_API)
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