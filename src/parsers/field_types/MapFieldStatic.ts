
/**
 * Use it when the definition is static (ie hardcoded). It will have the correct return type so no need to manually type returns.
 * Warrning: It relies on the fact that Object.entries respects the order of keys in an object, howerever there are exceptions where object key order is changed: if the key is a valid number (even if is coded as string ie: "11") it will be put at the start of the object. do not use it in dynamic scenarios.
 *
 * For dynamic/variable definitions use MapField
 * @param definition
 * @param separator - separator, default is `|`
 * @returns
 */
export default function MapFieldStatic<V extends { [x: string]: (...args: Array<any>)=>any } > (definition: V, separator?: string): (...args: Array<any>) => { [Property in keyof V]: ReturnType<V[Property]> } {
  return value => {
    const fields = String(value).split(separator || '|')
    const entries = Object.entries(definition)
    if (fields.length !== entries.length) {
      throw new Error(`Definition and input item length missmatch input: ${ fields.length } definition: ${ entries.length }`)
    }

    const parsed_response = entries.reduce((res, [ field_name, field_parser ], idx) => ({ ...res, [field_name]: field_parser(fields[idx]) }), {})
    return parsed_response as { [Property in keyof V]: ReturnType<V[Property]> }
  }
}
