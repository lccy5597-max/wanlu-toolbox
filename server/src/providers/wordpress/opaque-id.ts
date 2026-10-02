import { providerInvalidPayload } from '../provider-error'

export interface DecodedWordPressArticleId {
  readonly provider: 'wordpress'
  readonly id: number
}

export const decodeWordPressArticleId = (opaqueId: string): DecodedWordPressArticleId => {
  const match = /^wp:([1-9]\d*)$/.exec(opaqueId)
  if (!match) throw providerInvalidPayload()
  const id = Number(match[1])
  if (!Number.isSafeInteger(id) || id < 1) throw providerInvalidPayload()
  return Object.freeze({ provider: 'wordpress' as const, id })
}
