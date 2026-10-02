import type { RequestHandler } from 'express'
import { API_VERSION } from '../constants/api'
import { successEnvelope } from '../utils/envelope'

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(successEnvelope({
    status: 'ok',
    apiVersion: API_VERSION,
    serverTime: new Date().toISOString(),
  }))
}
