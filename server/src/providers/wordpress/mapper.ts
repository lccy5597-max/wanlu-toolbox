import type { ContentDetailSanitizerInput, ContentSummary } from '../contracts'
import {
  createWordPressArticleId,
  normalizeWordPressCategory,
  normalizeWordPressCover,
  normalizeWordPressExcerpt,
  normalizeWordPressPublishTime,
  normalizeWordPressTitle,
} from './normalizers'
import { parseWordPressDetailPost, parseWordPressListPost } from './validation'

export const mapWordPressSummary = (value: unknown): ContentSummary => {
  const post = parseWordPressListPost(value)
  return {
    id: createWordPressArticleId(post.id),
    title: normalizeWordPressTitle(post.title.rendered),
    excerpt: normalizeWordPressExcerpt(post.excerpt.rendered),
    cover: normalizeWordPressCover(post) ?? '',
    publishTime: normalizeWordPressPublishTime(post.date_gmt),
    category: normalizeWordPressCategory(post),
  }
}

export const mapWordPressDetailToSanitizerInput = (value: unknown): ContentDetailSanitizerInput => {
  const post = parseWordPressDetailPost(value)
  const cover = normalizeWordPressCover(post)
  const mapped: ContentDetailSanitizerInput = {
    id: createWordPressArticleId(post.id),
    title: normalizeWordPressTitle(post.title.rendered),
    rawHtml: post.content.rendered,
    publishTime: normalizeWordPressPublishTime(post.date_gmt),
    category: normalizeWordPressCategory(post),
    ...(cover === undefined ? {} : { cover }),
  }
  return mapped
}
