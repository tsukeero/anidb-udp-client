import { MapField } from './field_types/'
import type { AnidbCacheImplType } from '../utils/AnidbCache'

export type MaskDefinition<T> = Record<T & string, readonly [number, number, (...args: Array<any>) => any]>;

export default class MaskUtil<T extends string> {
  fields: any[]
  mask: string
  static readonly mask_definition: MaskDefinition<string>
  parseData: (data: string) => Record<string, any>

  constructor (mask: Array<T> | string) {
    if (typeof mask === 'string') {
      this.fields = this._decode(mask)
      this.mask = mask
    } else {
      this.fields = this._prepareMaskArray(mask)
      this.mask = this._encode(this.fields)
    }
    const { mask_definition } = this.constructor as typeof MaskUtil
    this.parseData = MapField(new Map(this.fields.map(field => [ field, mask_definition[field][2] ])))
  }

  verifyObject = (object: Awaited<ReturnType<AnidbCacheImplType['get']>>) => {
    return !!(object && typeof object === 'object' && this.fields.every(f => f in object ))
  }

  _prepareMaskArray (mask_array: Array<T>) {
    const deduplicated = Array.from(new Set(mask_array))
    const {
      mask_definition,
    } = this.constructor as typeof MaskUtil
    // check all exist!
    let incorrect_field = ''

    if (!deduplicated.every(i => {
      incorrect_field = i
      return i in mask_definition // .hasOwnProperty(i)
    })) {
      throw new Error(`Bad field: ${ incorrect_field }`)
    }

    return deduplicated.sort((a, b) => {
      const a_value = mask_definition[a][0] * 1000 - mask_definition[a][1]
      const b_value = mask_definition[b][0] * 1000 - mask_definition[b][1]
      return a_value - b_value
    })
  }

  // TODO: maybe switch to buffer?
  _encode (mask_array: Array<T>): string {
    const {
      mask_definition,
    } = this.constructor as typeof MaskUtil
    const mask = Array(Object.values(mask_definition).reduce((m, c) => c[0] + 1 > m ? c[0] + 1 : m, 0)).fill(0)

    // const mask = [ 0, 0, 0, 0, 0, 0, 0 ]
    for (const mask_item of mask_array) {
      const flag_definition = mask_definition[mask_item]
      const [ byte_num, bit_value ] = flag_definition
      mask[byte_num] = (mask[byte_num] || 0) + bit_value
    }

    const buf = Buffer.from(mask)
    return buf.toString('hex')
  }

  // Shitty, but only used in debugging anyway
  _decode (encoded_mask: string): Array<any> {
    const {
      mask_definition,
    } = this.constructor as typeof MaskUtil
    const mask_array = []

    const enc_buf = Buffer.from(encoded_mask.padEnd(14, '0'), 'hex')

    for (let i = 0; i < 7; i++) {
      const relevant_keys = Object.keys(mask_definition).filter(m => mask_definition[m][0] === i)
      const value = enc_buf.readInt8(i)

      for (const key of relevant_keys) {
        const flag_v = mask_definition[key][1]

        if ((value & flag_v) > 0) {
          mask_array.push(key)
        }
      }
    }

    return mask_array
  }

}