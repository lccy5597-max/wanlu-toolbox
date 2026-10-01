const createUnavailableError = () => {
  const error = new Error('wx.request is unavailable')
  error.code = 'WX_REQUEST_UNAVAILABLE'
  return error
}

const resolveDefaultRequestImpl = () => {
  if (typeof wx !== 'undefined' && wx && typeof wx.request === 'function') return (requestOptions) => wx.request(requestOptions)
  return null
}

const createWechatTransport = (options = {}) => {
  const injectedRequestImpl = typeof options.requestImpl === 'function' ? options.requestImpl : null

  const request = (requestOptions = {}) => new Promise((resolve, reject) => {
    const requestImpl = injectedRequestImpl || resolveDefaultRequestImpl()
    if (!requestImpl) {
      reject(createUnavailableError())
      return
    }

    const headers = requestOptions.headers && typeof requestOptions.headers === 'object'
      ? { ...requestOptions.headers }
      : {}

    try {
      requestImpl({
        url: requestOptions.url,
        method: requestOptions.method,
        header: headers,
        data: requestOptions.data,
        timeout: requestOptions.timeout,
        success: (response = {}) => {
          resolve({
            statusCode: response.statusCode,
            data: response.data,
            headers: response.header && typeof response.header === 'object' ? { ...response.header } : {},
            cookies: Array.isArray(response.cookies) ? response.cookies.slice() : [],
          })
        },
        fail: () => reject(new Error('wx_request_failed')),
      })
    } catch (error) {
      reject(error)
    }
  })

  return Object.freeze({ request })
}

module.exports = {
  createWechatTransport,
}
