const uuid = require('uuid/v4')
const log = require('debug')('app:error-handler')

module.exports = async function (expressApp) {
  expressApp.use ((error, req, res, next) => {
    log(` >> ExpressError @ RouteType[${req.routeType}]`, error.toString())
    log(error)
    const errorUuid = res.get('X-Call-Ref') || uuid()
    if (req.routeType === 'api' || (req.get('content-type') || '').match(/json/)) {
      log(`FATAL ERROR [ ${errorUuid} ]`, error.toString())
      res.status(500).json({
        error: true,
        message: 'Sh#t hits the fan :(',
        reference: errorUuid,
        code: 500,
        req: req.url || '',
        method: req.method || ''
      })
    } else {
      res.status(500).render('500', { 
        error: error.toString()
                    .split('Error:')
                    .slice(1)
                    .join(' ')
                    .trim() 
      })
    }
  })
}
