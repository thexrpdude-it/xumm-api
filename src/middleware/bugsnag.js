module.exports = async function (expressApp) {
  if (typeof expressApp.config.bugsnagKey !== 'undefined') {
    const bugsnagClient = require('@bugsnag/js')({
      apiKey: expressApp.config.bugsnagKey,
      releaseStage: expressApp.config.__env || 'dev',
      filters: [
        /^secret$/i,
        /^authorization$/i
      ]
    })
    bugsnagClient.use(require('@bugsnag/plugin-express'))
    const middleware = bugsnagClient.getPlugin('express')
    expressApp.use(middleware.requestHandler)
    expressApp.use(middleware.errorHandler)
    expressApp.bugsnagClient = bugsnagClient
  }
}
