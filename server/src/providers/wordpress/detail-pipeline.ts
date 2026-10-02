import type { ContentDetail, ContentDetailSanitizerInput } from '../contracts'
import type { HtmlSanitizer } from '../../security/html-sanitizer'
import { serverHtmlSanitizer } from '../../security/html-sanitizer'

export const createSanitizedContentDetail = (
  input: ContentDetailSanitizerInput,
  sanitizer: HtmlSanitizer = serverHtmlSanitizer,
): ContentDetail => {
  const content = sanitizer.sanitize(input.rawHtml)
  return {
    id: input.id,
    title: input.title,
    content,
    publishTime: input.publishTime,
    category: input.category,
    ...(input.author === undefined ? {} : { author: input.author }),
    ...(input.cover === undefined ? {} : { cover: input.cover }),
  }
}
