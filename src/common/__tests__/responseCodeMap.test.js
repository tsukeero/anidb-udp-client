import { RESPONSE_CODE, getResponse } from '../responseCodeMap'
import { AnidbError } from '../AnidbError'

test('response codes are unique', () => {
  const byCode = {}
  for (const [ label, code ] of Object.entries(RESPONSE_CODE)) {
    (byCode[code] ||= []).push(label)
  }
  const duplicates = Object.entries(byCode).filter(([ , labels ]) => labels.length > 1)
  expect(duplicates).toEqual([])
})

test('every code maps back to its label', () => {
  for (const [ label, code ] of Object.entries(RESPONSE_CODE)) {
    expect(getResponse(code)).toBe(label)
  }
})

test('NOT_CONNECTED and FAILED_TO_INITIALIZE errors are distinguishable', () => {
  const notConnected = new AnidbError(RESPONSE_CODE.NOT_CONNECTED)
  const failedInit = new AnidbError(RESPONSE_CODE.FAILED_TO_INITIALIZE)

  expect(notConnected.label).toBe('NOT_CONNECTED')
  expect(failedInit.label).toBe('FAILED_TO_INITIALIZE')
  expect(notConnected.code).not.toBe(failedInit.code)
})
