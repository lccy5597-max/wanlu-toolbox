import { providerInvalidPayload } from '../provider-error'
import type { WordPressRawListPost } from './raw-types'

const NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
})

export const decodeHtmlEntities = (value: string): string => value.replace(
  /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
  (match, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
    if (decimal !== undefined) {
      const codePoint = Number(decimal)
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match
    }
    if (hexadecimal !== undefined) {
      const codePoint = Number.parseInt(hexadecimal, 16)
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match
    }
    if (named !== undefined) return NAMED_ENTITIES[named.toLowerCase()] ?? match
    return match
  },
)

export const normalizePlainText = (value: string): string => decodeHtmlEntities(
  value.replace(/<[^>]*>/g, ' '),
).replace(/\s+/g, ' ').trim()

export const normalizeWordPressTitle = (value: string): string => {
  const normalized = normalizePlainText(value)
  if (!normalized) throw providerInvalidPayload()
  return normalized
}

export const normalizeWordPressExcerpt = (value: string): string => normalizePlainText(value)

export const normalizeWordPressPublishTime = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)) {
    throw providerInvalidPayload()
  }
  const utcValue = `${value}Z`
  if (!Number.isFinite(Date.parse(utcValue))) throw providerInvalidPayload()
  return utcValue
}

export const createWordPressArticleId = (id: number): string => {
  if (!Number.isSafeInteger(id) || id < 1) throw providerInvalidPayload()
  return `wp:${id}`
}

export const normalizeWordPressCover = (post: WordPressRawListPost): string | undefined => {
  const media = post._embedded?.['wp:featuredmedia']
  if (media === undefined || media.length === 0) return undefined
  const source = media[0]?.source_url
  if (typeof source !== 'string' || !/^https:\/\//i.test(source)) throw providerInvalidPayload()
  return source
}

export const normalizeWordPressCategory = (post: WordPressRawListPost): string => {
  const groups = post._embedded?.['wp:term'] ?? []
  for (const group of groups) {
    for (const term of group) {
      if (term.taxonomy !== 'category') continue
      const name = normalizePlainText(term.name)
      if (name) return name
    }
  }
  throw providerInvalidPayload()
}
