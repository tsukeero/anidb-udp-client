export default function reverseObj<T extends {[index: string | number ]: string| number}> (input: T): {[K in keyof T as T[K]]: K} {
  return Object.entries(input).reduce((r, [ key, value ]) => ({ ...r, [value]: key }), {}) as {[K in keyof T as T[K]]: K}
}