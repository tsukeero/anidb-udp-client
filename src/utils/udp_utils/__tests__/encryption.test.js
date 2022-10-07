import * as encryption from '../encryption'

const TEST_KEY = 'test_key'
const TEST_SALT = 'test_salt'

const TEST_MESSAGE = 'random text'
const TEST_ENCRYPTED_MESSAGE = Buffer.from('fb7caed479b02bd9a31599958ff60b33','hex')

describe('encryption', () => {
  test('createKey',() => {
    const key = encryption.createKey(TEST_KEY, TEST_SALT)
    expect(key.toString('hex')).toMatchInlineSnapshot(`"a9bcd3a95342b06c13861a45d9d30011"`)
  })
  test('encrypt',() => {
    const key = encryption.createKey(TEST_KEY, TEST_SALT)
    const encrypted = encryption.encrypt(TEST_MESSAGE, key)
    expect(encrypted.equals(TEST_ENCRYPTED_MESSAGE)).toBe(true)
  })
  test('decrypt',() => {
    const key = encryption.createKey(TEST_KEY, TEST_SALT)
    const decrypted = encryption.decrypt(TEST_ENCRYPTED_MESSAGE, key)
    expect(decrypted.toString('utf8')).toEqual(TEST_MESSAGE)
  })

})