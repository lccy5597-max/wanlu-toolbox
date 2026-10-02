export interface WordPressRenderedField {
  readonly rendered: string
}

export interface WordPressRawFeaturedMedia {
  readonly source_url: string
}

export interface WordPressRawTerm {
  readonly taxonomy: string
  readonly name: string
}

export interface WordPressRawEmbedded {
  readonly 'wp:featuredmedia'?: readonly WordPressRawFeaturedMedia[]
  readonly 'wp:term'?: readonly (readonly WordPressRawTerm[])[]
}

export interface WordPressRawListPost {
  readonly id: number
  readonly date_gmt: string
  readonly title: WordPressRenderedField
  readonly excerpt: WordPressRenderedField
  readonly _embedded?: WordPressRawEmbedded
}

export interface WordPressRawDetailPost extends WordPressRawListPost {
  readonly content: WordPressRenderedField
}
