export type HttpQueryValue = string | number | boolean

export interface HttpGetRequest {
  readonly path: string
  readonly query?: Readonly<Record<string, HttpQueryValue>>
}

export interface HttpResponse<T> {
  readonly status: number
  readonly data: T
  readonly headers?: Readonly<Record<string, string>>
}

export interface HttpClient {
  get<T>(request: HttpGetRequest): Promise<HttpResponse<T>>
}
