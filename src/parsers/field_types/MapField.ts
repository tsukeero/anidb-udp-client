/**
 *
 * @export
 * @template T
 * @param {Map<string, Function>} definition
 * @param {string} [separator]
 * @returns {T}
 */
export default function MapField (definition: Map<string, (...args: Array<any>) => any>, separator?: string): (...args: Array<any>) => any {
  return value => {
    const fields = String(value).split(separator || '|')

    if (fields.length !== definition.size) {
      throw new Error(`Definition and input item length missmatch input: ${ fields.length } definition: ${ definition.size }`)
    }

    const parsed_response: Record<string, any> = {}
    let idx = 0

    for (const [ field_name, field_parser ] of definition) {
      parsed_response[field_name] = field_parser(fields[idx])
      idx++
    }

    return parsed_response
  }
}
