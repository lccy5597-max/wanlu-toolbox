import { providerInvalidPayload } from '../provider-error'
import {
  normalizeWordPressCategory,
  normalizeWordPressCover,
  normalizeWordPressPublishTime,
  normalizeWordPressTitle,
} from './normalizers'
import type {
  WordPressRawDetailPost,
  WordPressRawEmbedded,
  WordPressRawListPost,
  WordPressRenderedField,
} from './raw-types'

const isPlainObject = (value: unknown): value is Record<string, unknown> => Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)

const isRenderedField = (value: unknown): value is WordPressRenderedField => isPlainObject(value)
  && typeof value.rendered === 'string'

const validateEmbeddedShape = (value: unknown): value is WordPressRawEmbedded => {
  if (value === undefined) return true
  if (!isPlainObject(value)) return false

  const media = value['wp:featuredmedia']
  if (media !== undefined) {
    if (!Array.isArray(media)) return false
    for (const item of media) {
      if (!isPlainObject(item) || typeof item.source_url !== 'string') return false
    }
  }

  const termGroups = value['wp:term']
  if (termGroups !== undefined) {
    if (!Array.isArray(termGroups)) return false
    for (const group of termGroups) {
      if (!Array.isArray(group)) return false
      for (const term of group) {
        if (!isPlainObject(term) || typeof term.taxonomy !== 'string' || typeof term.name !== 'string') return false
      }
    }
  }
  return true
}

const parseCommonPost = (value: unknown): WordPressRawListPost => {
  if (!isPlainObject(value)) throw providerInvalidPayload()
  if (!Number.isSafeInteger(value.id) || Number(value.id) < 1) throw providerInvalidPayload()
  if (typeof value.date_gmt !== 'string') throw providerInvalidPayload()
  if (!isRenderedField(value.title) || !isRenderedField(value.excerpt)) throw providerInvalidPayload()
  if (!validateEmbeddedShape(value._embedded)) throw providerInvalidPayload()

  const post = value as unknown as WordPressRawListPost
  normalizeWordPressTitle(post.title.rendered)
  normalizeWordPressPublishTime(post.date_gmt)
  normalizeWordPressCover(post)
  normalizeWordPressCategory(post)
  return post
}

export const parseWordPressListPost = (value: unknown): WordPressRawListPost => parseCommonPost(value)

export const parseWordPressDetailPost = (value: unknown): WordPressRawDetailPost => {
  const post = parseCommonPost(value)
  const source = value as Record<string, unknown>
  if (!isRenderedField(source.content)) throw providerInvalidPayload()
  return { ...post, content: source.content }
}

export const parseWordPressListPayload = (value: unknown): readonly WordPressRawListPost[] => {
  if (!Array.isArray(value)) throw providerInvalidPayload()
  return value.map((item) => parseWordPressListPost(item))
}
