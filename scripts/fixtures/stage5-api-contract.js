const articleSummary = Object.freeze({
  id: 'article-1001',
  title: '挽鹿示例文章',
  excerpt: '用于 Stage 5 API Contract 测试的摘要。',
  cover: 'https://cdn.example.com/articles/1001-cover.webp',
  publishTime: '2026-10-01T08:30:00+08:00',
  category: 'AI教程',
  author: '挽鹿资讯网',
})

const articleDetail = Object.freeze({
  id: articleSummary.id,
  title: articleSummary.title,
  content: '<p>这是已经由服务端清洗的安全 HTML。</p><p><img src="https://cdn.example.com/articles/1001-1.webp" /></p>',
  publishTime: articleSummary.publishTime,
  category: articleSummary.category,
  author: articleSummary.author,
  cover: articleSummary.cover,
})

const githubItem = Object.freeze({
  id: 'repo-1001',
  name: 'example-repo',
  fullName: 'example/example-repo',
  description: 'Stage 5 API Contract fixture.',
  author: 'example',
  stars: 1234,
  language: 'JavaScript',
  url: 'https://github.com/example/example-repo',
  updatedAt: '2026-10-01T00:00:00Z',
})

const githubItemSecond = Object.freeze({
  id: 'repo-1002',
  name: 'second-example',
  fullName: 'example/second-example',
  description: 'Second Stage 5 GitHub fixture.',
  author: 'example',
  stars: 9876,
  language: 'TypeScript',
  url: 'https://github.com/example/second-example',
  updatedAt: '2026-10-01T01:00:00Z',
})

const githubRankingFixture = (period, items = [githubItem], pagination = {}) => Object.freeze({
  statusCode: 200,
  data: Object.freeze({
    code: 0,
    message: 'ok',
    data: Object.freeze({ period, items: Object.freeze(items) }),
    meta: Object.freeze({
      pagination: Object.freeze({
        page: pagination.page === undefined ? 1 : pagination.page,
        pageSize: pagination.pageSize === undefined ? 5 : pagination.pageSize,
        total: pagination.total === undefined ? items.length : pagination.total,
        hasMore: pagination.hasMore === undefined ? false : pagination.hasMore,
      }),
      requestId: `req-fixture-github-${period}`,
    }),
  }),
})

module.exports = Object.freeze({
  articleDetail,
  articleListSuccess: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({ items: Object.freeze([articleSummary]) }),
      meta: Object.freeze({
        pagination: Object.freeze({ page: 1, pageSize: 10, total: 1, hasMore: false }),
        requestId: 'req-fixture-content-list',
      }),
    }),
  }),
  articleSummary,
  emptyArticleList: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({ items: Object.freeze([]) }),
      meta: Object.freeze({
        pagination: Object.freeze({ page: 1, pageSize: 10, total: 0, hasMore: false }),
        requestId: 'req-fixture-content-empty',
      }),
    }),
  }),
  invalidArticleSummary: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({ items: Object.freeze([{ ...articleSummary, title: '' }]) }),
      meta: Object.freeze({
        pagination: Object.freeze({ page: 1, pageSize: 10, total: 1, hasMore: false }),
      }),
    }),
  }),
  invalidArticleDetail: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({ ...articleDetail, content: '<script>alert(1)</script>' }),
      meta: Object.freeze({}),
    }),
  }),
  invalidPagination: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({ items: Object.freeze([articleSummary]) }),
      meta: Object.freeze({
        pagination: Object.freeze({ page: 1, pageSize: 10, total: -1, hasMore: false }),
      }),
    }),
  }),
  articleDetailSuccess: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: articleDetail,
      meta: Object.freeze({ requestId: 'req-fixture-content-detail' }),
    }),
  }),
  businessError: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 20004,
      message: 'content_not_found',
      data: null,
      meta: Object.freeze({ requestId: 'req-fixture-business-error' }),
    }),
  }),
  githubItem,
  githubItemSecond,
  githubRankingsSuccess: githubRankingFixture('daily'),
  validGithubDaily: githubRankingFixture('daily', [githubItem, githubItemSecond], { total: 2 }),
  validGithubWeekly: githubRankingFixture('weekly'),
  validGithubAll: githubRankingFixture('all'),
  emptyGithubRanking: githubRankingFixture('daily', [], { total: 0 }),
  invalidGithubItem: githubRankingFixture('daily', [Object.freeze({ ...githubItem, stars: -1 })]),
  invalidGithubPagination: githubRankingFixture('daily', [githubItem], { total: -1 }),
  githubUpstreamError: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 30054,
      message: 'github_upstream_error',
      data: null,
      meta: Object.freeze({ requestId: 'req-fixture-github-upstream-error' }),
    }),
  }),
  healthSuccess: Object.freeze({
    statusCode: 200,
    data: Object.freeze({
      code: 0,
      message: 'ok',
      data: Object.freeze({
        status: 'ok',
        apiVersion: 'v1',
        serverTime: '2026-10-01T08:30:00+08:00',
      }),
      meta: Object.freeze({ requestId: 'req-fixture-health' }),
    }),
  }),
  rateLimit: Object.freeze({
    statusCode: 429,
    data: Object.freeze({
      code: 10029,
      message: 'rate_limited',
      data: null,
      meta: Object.freeze({ retryAfter: 30, requestId: 'req-fixture-rate-limit' }),
    }),
  }),
})
