module.exports = async function (expressApp) {
  expressApp.use((req, res, next) => {
    if (typeof req.config.logRequestsToConsole !== 'undefined' && req.config.logRequestsToConsole) {
      console.log(`>> ${req.method} [${req.config.mode}, trusted: ${req.ipTrusted ? 1 : 0}] Got [${req.routeType}] call [${req.headers['content-type']||'NO CONTENT-TYPE'}] to [${req.url}] from ${req.remoteAddress}`)
    }
    next()
  })
}
