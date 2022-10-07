
import crypto from 'node:crypto'

export function encrypt (input: string | Buffer, key: string | Buffer) {
  const algorithm = 'aes-128-ecb'
  const cipher = crypto.createCipheriv(algorithm, key, null)
  cipher.setAutoPadding(true)
  return Buffer.concat([ cipher.update(input), cipher.final() ])
}

export function createKey (udp_api_key: string, salt: string) {
  return crypto.createHash('md5').update(udp_api_key + salt).digest()
}

export function decrypt (input: Buffer, key: string | Buffer) {
  const algorithm = 'aes-128-ecb'
  const decipher = crypto.createDecipheriv(algorithm, key, null)
  decipher.setAutoPadding(true)
  return Buffer.concat([ decipher.update(input), decipher.final() ])
}