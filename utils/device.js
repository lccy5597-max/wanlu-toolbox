const { getPlatform } = require('./system-info')


const isDesktopPlatform = () => {
  const platform = getPlatform()

  return ['windows', 'mac', 'devtools'].includes(platform)
}

module.exports = {
  getPlatform,
  isDesktopPlatform,
}
