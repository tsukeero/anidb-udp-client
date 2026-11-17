import { decodeFileState } from '../fileState'

test('decodeFileState no flags', () => {
  expect(decodeFileState('0')).toEqual({
    crc_ok: false,
    crc_err: false,
    version: 1,
    censored: false,
    uncensored: false,
  })
})

test('decodeFileState crc ok, v1', () => {
  expect(decodeFileState('1')).toEqual({
    crc_ok: true,
    crc_err: false,
    version: 1,
    censored: false,
    uncensored: false,
  })
})

test('decodeFileState versions', () => {
  expect(decodeFileState(4).version).toBe(2)
  expect(decodeFileState(8).version).toBe(3)
  expect(decodeFileState(16).version).toBe(4)
  expect(decodeFileState(32).version).toBe(5)
})

test('decodeFileState censorship', () => {
  expect(decodeFileState('65')).toMatchObject({ crc_ok: true, uncensored: true, censored: false })
  expect(decodeFileState('130')).toMatchObject({ crc_err: true, censored: true, uncensored: false })
  expect(decodeFileState(1 + 4 + 64)).toEqual({
    crc_ok: true,
    crc_err: false,
    version: 2,
    censored: false,
    uncensored: true,
  })
})

test('decodeFileState invalid input', () => {
  expect(decodeFileState('')).toMatchObject({ version: 1, censored: false }) // empty field = no flags
  expect(() => decodeFileState('abc')).toThrow(TypeError)
  expect(() => decodeFileState(-1)).toThrow(TypeError)
  expect(() => decodeFileState('1.5')).toThrow(TypeError)
})
