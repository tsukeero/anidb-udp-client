import { XMLParser } from 'fast-xml-parser'

// shared helpers for the HTTP API parsers: every value arrives as a string (or `{ '#text', '@_attr' }` object)

export type HTTPTitle = { title: string, lang: string, type?: string }
export type HTTPRating = { value: number, count: number }

export type XmlNode = Record<string, any>

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  alwaysCreateTextNode: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

export function parseXml (xml: string): XmlNode {
  return xmlParser.parse(xml)
}

export const list = (node: unknown): XmlNode[] => node === undefined || node === null || node === '' ? [] : Array.isArray(node) ? node : [ node as XmlNode ]

export const text = (node: unknown): string | undefined => {
  if (node === undefined || node === null) {
    return undefined
  }
  if (typeof node === 'object') {
    const value = (node as XmlNode)['#text']
    return value === undefined ? undefined : String(value)
  }
  return String(node)
}

export const num = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

export const bool = (value: unknown): boolean => value === 'true' || value === '1'

export const attr = (node: unknown, name: string): string | undefined => node && typeof node === 'object' ? (node as XmlNode)[`@_${ name }`] : undefined

/** `<permanent count="4430">8.16</permanent>`; `scale` divides the value (some lists send `816` for 8.16) */
export const rating = (node: unknown, scale = 1): HTTPRating | undefined => {
  const value = num(text(node))
  return value === undefined ? undefined : { value: value / scale, count: num(attr(node, 'count') ?? attr(node, 'votes')) ?? 0 }
}

export const title = (node: XmlNode): HTTPTitle => ({
  title: text(node) ?? '',
  lang: attr(node, 'xml:lang') ?? '',
  ...attr(node, 'type') ? { type: attr(node, 'type') } : {},
})

/** drop keys whose value is `undefined`, so results are stable for snapshots / JSON */
export const compact = <T extends Record<string, any>>(obj: T): T => Object.fromEntries(Object.entries(obj).filter(([ , v ]) => v !== undefined)) as T
