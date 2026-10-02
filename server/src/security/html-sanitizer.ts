import sanitizeHtml from 'sanitize-html'

export const MAX_RAW_HTML_BYTES = 512 * 1024
export const MAX_SANITIZED_HTML_BYTES = 256 * 1024

export const ALLOWED_HTML_TAGS = Object.freeze([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'figure',
  'figcaption',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'code',
  'span',
  'div',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

export const ALLOWED_HTML_ATTRIBUTES = Object.freeze({
  img: Object.freeze(['src', 'alt', 'title']),
  th: Object.freeze(['colspan', 'rowspan']),
  td: Object.freeze(['colspan', 'rowspan']),
})

export type HtmlSanitizationErrorKind = 'invalid_input' | 'input_too_large' | 'output_too_large' | 'sanitization_failed'

export class HtmlSanitizationError extends Error {
  readonly kind: HtmlSanitizationErrorKind

  constructor(kind: HtmlSanitizationErrorKind) {
    super(`html_sanitization_${kind}`)
    this.name = 'HtmlSanitizationError'
    this.kind = kind
  }
}

export interface HtmlSanitizer {
  sanitize(rawHtml: string): string
}

const isAbsoluteHttpsUrl = (value: string | undefined): boolean => {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol.toLowerCase() === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = Object.freeze({
  allowedTags: [...ALLOWED_HTML_TAGS],
  allowedAttributes: {
    img: [...ALLOWED_HTML_ATTRIBUTES.img],
    th: [...ALLOWED_HTML_ATTRIBUTES.th],
    td: [...ALLOWED_HTML_ATTRIBUTES.td],
  },
  allowedSchemes: ['https'],
  allowedSchemesByTag: {
    img: ['https'],
  },
  allowedSchemesAppliedToAttributes: ['src', 'href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  parseStyleAttributes: false,
  nestingLimit: 40,
  exclusiveFilter: (frame: sanitizeHtml.IFrame) => frame.tag === 'img' && !isAbsoluteHttpsUrl(frame.attribs.src),
})

export class ServerHtmlSanitizer implements HtmlSanitizer {
  sanitize(rawHtml: string): string {
    if (typeof rawHtml !== 'string') throw new HtmlSanitizationError('invalid_input')
    if (Buffer.byteLength(rawHtml, 'utf8') > MAX_RAW_HTML_BYTES) {
      throw new HtmlSanitizationError('input_too_large')
    }

    let sanitized: string
    try {
      sanitized = sanitizeHtml(rawHtml, SANITIZE_OPTIONS)
    } catch {
      throw new HtmlSanitizationError('sanitization_failed')
    }

    if (Buffer.byteLength(sanitized, 'utf8') > MAX_SANITIZED_HTML_BYTES) {
      throw new HtmlSanitizationError('output_too_large')
    }
    return sanitized
  }
}

export const serverHtmlSanitizer: HtmlSanitizer = Object.freeze(new ServerHtmlSanitizer())
