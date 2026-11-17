/**
 * Bit flags of the FILE `state` field, as defined by the AniDB UDP API.
 */
export const FILE_STATE = {
  CRC_OK: 1,
  CRC_ERR: 2,
  IS_V2: 4,
  IS_V3: 8,
  IS_V4: 16,
  IS_V5: 32,
  UNCENSORED: 64,
  CENSORED: 128,
} as const

export type DecodedFileState = {
  /** CRC32 of the file matches the official CRC */
  crc_ok: boolean
  /** CRC32 of the file does not match the official CRC */
  crc_err: boolean
  /** File version (1 when no version flag is set) */
  version: 1 | 2 | 3 | 4 | 5
  /** File is flagged as censored */
  censored: boolean
  /** File is flagged as uncensored */
  uncensored: boolean
}

/**
 * Decodes the `state` field returned by `file()`, `file_by_hash()` and `file_by_episode()`.
 *
 * When neither `censored` nor `uncensored` is set, AniDB has no censorship information for the file.
 *
 * @param state raw `state` value
 * @example
 * const { censored, uncensored } = decodeFileState((await client.file(fid, [ 'state' ])).state)
 */
export function decodeFileState (state: string | number): DecodedFileState {
  const s = Number(state)
  if (!Number.isInteger(s) || s < 0) {
    throw new TypeError(`Invalid file state: ${ state }`)
  }

  let version: DecodedFileState['version'] = 1
  if (s & FILE_STATE.IS_V5) version = 5
  else if (s & FILE_STATE.IS_V4) version = 4
  else if (s & FILE_STATE.IS_V3) version = 3
  else if (s & FILE_STATE.IS_V2) version = 2

  return {
    crc_ok: !!(s & FILE_STATE.CRC_OK),
    crc_err: !!(s & FILE_STATE.CRC_ERR),
    version,
    censored: !!(s & FILE_STATE.CENSORED),
    uncensored: !!(s & FILE_STATE.UNCENSORED),
  }
}
