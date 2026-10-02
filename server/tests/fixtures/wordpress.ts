export const wordpressListPostFixture = Object.freeze({
  id: 1001,
  date_gmt: '2026-10-01T00:30:00',
  title: Object.freeze({ rendered: 'Test &amp; Article' }),
  excerpt: Object.freeze({ rendered: '<p>Fixture <strong>summary</strong>&nbsp;text.</p>' }),
  categories: Object.freeze([7]),
  guid: Object.freeze({ rendered: 'https://fixture.invalid/?p=1001' }),
  yoast_head: '<meta name="description" content="fixture only">',
  _embedded: Object.freeze({
    'wp:featuredmedia': Object.freeze([
      Object.freeze({ source_url: 'https://cdn.example.com/test/article-1001.webp' }),
    ]),
    'wp:term': Object.freeze([
      Object.freeze([
        Object.freeze({ taxonomy: 'category', name: 'AI &amp; Tools' }),
      ]),
    ]),
  }),
})

export const wordpressDetailPostFixture = Object.freeze({
  ...wordpressListPostFixture,
  content: Object.freeze({
    rendered: '<p data-test="raw">Raw <strong>WordPress</strong> HTML.</p>',
  }),
})

export const wordpressMissingCoverFixture = Object.freeze({
  ...wordpressListPostFixture,
  id: 1002,
  _embedded: Object.freeze({
    'wp:term': wordpressListPostFixture._embedded['wp:term'],
  }),
})
