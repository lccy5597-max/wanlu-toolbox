import { createApp } from './app'
import { loadServerConfig } from './config/environment'

const config = loadServerConfig()
const app = createApp(config)

const server = app.listen(config.port, config.host, () => {
  console.log(`Wanlu Toolbox server listening on http://${config.host}:${config.port}`)
})

server.once('error', (error) => {
  console.error('Wanlu Toolbox server startup failed', error instanceof Error ? error.message : 'unknown_error')
  process.exitCode = 1
})

let shutdownStarted = false
const shutdown = (signal: 'SIGTERM' | 'SIGINT'): void => {
  if (shutdownStarted) return
  shutdownStarted = true
  console.log(`Wanlu Toolbox server received ${signal}; closing`)
  server.close((error) => {
    if (error) {
      console.error('Wanlu Toolbox server shutdown failed', error.message)
      process.exitCode = 1
    }
  })
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
