export default function CodedField<T extends number | string, U extends number | string> (def: Record<U, T>, parser?: (...args: Array<any>) => U) {
  return function (key: U, ...args: Array<unknown>): T {
    return def[parser ? parser(key, ...args) : key]
  }
}