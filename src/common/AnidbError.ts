import { RESPONSE_CODE as RESPONSES, getResponse, RESPONSE_CODE } from './responseCodeMap'

export class AnidbError extends Error {

  code: typeof RESPONSES[keyof typeof RESPONSES]
  label: keyof typeof RESPONSES
  /** Parsed anidb response (some errors carry payloads, usually specified on the method docs) */
  payload: Record<string|number, any> | undefined

  /**
   *
   * @param code response code {@link RESPONSE_CODE}
   * @param message additional message
   */
  constructor (code?: typeof RESPONSES[keyof typeof RESPONSES], message?: string, payload?: Record<string|number, any>) {
    super()
    const fixedCode = (code && Object.values(RESPONSE_CODE).includes(code)) ? code : RESPONSES.UNKNOWN_API_ERROR as typeof RESPONSES[keyof typeof RESPONSES]
    // const fixedCode = code || RESPONSES.UNKNOWN_API_ERROR

    let label = getResponse(fixedCode) as keyof typeof RESPONSES

    if (!label) {
      label = 'UNKNOWN_API_ERROR'
    }

    this.name = 'AnidbError'
    this.message = message || `${ fixedCode }: ${ label }`
    this.code = fixedCode
    this.label = label
    this.payload = payload
    this.stack = new Error().stack // Optional

    /* this.toString = function () {
        return `${this.name}: ${this.message}`
    } */
  }

} // AnidbError.prototype = Object.create(Error.prototype);

/*
export class UknownError extends AnidbError {
    constructor(api_name){
        const ERROR_NAME = 'UNKNOWN_API_ERROR'
        super(CUSTOM_ERRORS_CODES[ERROR_NAME],ERROR_NAME,api_name)
    }
}

export class TimeoutError extends AnidbError {
    constructor(api_name){
        const ERROR_NAME = 'CONNECTION_TIMEOUT'
        super(CUSTOM_ERRORS_CODES[ERROR_NAME],ERROR_NAME,api_name)
    }
}


export class NoConnectionError extends AnidbError {
    constructor(api_name){
        const ERROR_NAME = 'NOT_CONNECTED'
        super(CUSTOM_ERRORS_CODES[ERROR_NAME],ERROR_NAME,api_name)
    }
}
*/

export const GLOBAL_ERRORS = [ RESPONSES.BANNED, RESPONSES.UNKNOWN_COMMAND, RESPONSES.INTERNAL_SERVER_ERROR, RESPONSES.ILLEGAL_INPUT_OR_ACCESS_DENIED, RESPONSES.ANIDB_OUT_OF_SERVICE, RESPONSES.SERVER_BUSY, RESPONSES.TIMEOUT_DELAY_AND_RESUBMIT, RESPONSES.LOGIN_FIRST, RESPONSES.ACCESS_DENIED, RESPONSES.INVALID_SESSION ]
export const FATAL_ERROR_CODES = [// RESPONSES.LOGIN_FAILED,
  RESPONSES.ACCESS_DENIED, RESPONSES.CLIENT_VERSION_OUTDATED, RESPONSES.CLIENT_BANNED, RESPONSES.ILLEGAL_INPUT_OR_ACCESS_DENIED, // longer backofF?
  RESPONSES.BANNED, RESPONSES.ANIDB_OUT_OF_SERVICE, // until autologin is implemented
  RESPONSES.LOGIN_FIRST, RESPONSES.INVALID_SESSION, // backoff, retry later?
  RESPONSES.SERVER_BUSY, RESPONSES.TIMEOUT_DELAY_AND_RESUBMIT, RESPONSES.INTERNAL_SERVER_ERROR, // ???
  RESPONSES.NO_DATA, RESPONSES.API_VIOLATION, // maybe?
  RESPONSES.ENCODING_NOT_SUPPORTED, // all custom errors are fatal
  RESPONSES.UNKNOWN_API_ERROR, RESPONSES.CONNECTION_TIMEOUT, RESPONSES.NOT_CONNECTED ]