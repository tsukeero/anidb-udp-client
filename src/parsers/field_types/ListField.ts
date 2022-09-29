/**
 *
 *
 * @export
 * @param {Function} [type] item parser function
 * @param {string} [separator] separator to use, default is '
 * @param {boolean} [filter_empty] should empty string fields be filtered out
 * @returns
 */
export default function ListField<T> (type: (...args: Array<any>) => T, separator?: string, filter_empty?: boolean) {
  return function (value: string): Array<T> {
    return (value || '').split(separator || '\'').filter(v => filter_empty ? v !== '' : true).map(type)
  }
}