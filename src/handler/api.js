const express = require('express')
const bodyParser = require('body-parser')

module.exports = async function (expressApp) {
  expressApp.use(bodyParser.json())
  
  /**
   * API Router
   */
  const router = express.Router()

  router.get('/', function(req, res) {
    // throw new Error("BROKEN")
    res.json({ message: 'XRPL Labs - Signing Platform' })
  })

  const apiDefinition = {
    v1: {
      /**
       * App: custom auth, for our App
       */
      app: {
        middleware: 'auth/app',
        routes: [
          /**
           * add-user
           *    > Add user + pairing, new device, new registration
           * 
           * Disable middleware: no unique device ID is known yet,
           * wait for device activation callback.
           */
          { 
            method: 'post',
            path: 'add-user',
            disableMiddleware: true,
            // module: 'some-alt-file-at-disk'
          },
          { method: 'post',   path: 'activate-device', disableMiddleware: true },
          { method: 'post',   path: 'ping' },
          { method: 'post',   path: 'update-device' },
          { method: 'post',   path: 'add-device' },
          { method: 'get',    path: 'pending-devices' },
          { method: 'patch',  path: 'pending-devices' },
          { method: 'delete', path: 'pending-devices' },
        ]
      },
      /**
       * Platform: OAuth2 for 3rd party Developers
       */
      platform: {
        middleware: 'auth/platform',
        routes: [
        ]
      }
    }
  }

  Object.keys(apiDefinition).map(apiVersion => {
    Object.keys(apiDefinition[apiVersion]).map(apiType => {
      const apiDetails = apiDefinition[apiVersion][apiType]
      apiDetails.routes.map(route => {
        router[route.method](`/${apiVersion}/${apiType}/${route.path}`, [ async (req, res, next) => {
          if (typeof route.disableMiddleware === 'undefined' || !route.disableMiddleware) {
            require(`../middleware/${apiDetails.middleware}`)(expressApp, req, res, {
              route: route,
              version: apiVersion,
              type: apiType
            })
              .then(r => {
                if (typeof r !== 'undefined') {
                  // console.log(`API Auth middleware [ next ]`, r)
                  req.__auth = Object.keys(r).reduce((a, b) => {
                    const s = b.replace(/^_+/, '').split('_')
                    if (s[0] !== '') {
                      if (typeof a[s[0]] === 'undefined') a[s[0]] = {}
                      a[s[0]][s[1]] = r[b]
                    }
                    return a
                  }, {})
                }
                /**
                 * Middleware is allowed to send cusom responses, skip
                 * the followup method if his has happened.
                 */
                if (!res.headersSent) {
                  next()
                }
              })
              .catch(e => {
                /**
                 * Middleware is allowed to send cusom responses, skip
                 * the generic 500 error if this has happened.
                 */
                if (!res.headersSent) {
                  /**
                   * Todo: normalize errors (per api type?)
                   */
                  res.status(500).json({ 
                    error: true,
                    message: `API Auth middleware rejected: [ ${e.message} ]`,
                    code: 500,
                    reference: '',
                    req: req.url,
                    method: req.method
                  })
                }
              })
          } else {
            next()
          }
        } ], require(`../api/${apiVersion}/${apiType}/${route.module || route.path}`))
      })
    })
  })

  router.post('/', async (req, res, next) => {
    if (typeof req.body === 'object' && typeof req.body.name !== 'undefined') {
      res.json({ 
        message: 'Test response',
        env: {
          mode: req.config.mode,
          remoteAddress: req.remoteAddress,
          ipTrusted: req.ipTrusted
        },
        data: {
          body: req.body,
          query: req.query
        },
        db: await expressApp.db(`SELECT "YES" as online`)
      })
    } else {
      next()
    }
  })

  // API ROUTER WILDCARD - FALLBACK
  router.all('*', function(req, res){
    if ('OPTIONS' === req.method) {
      res.sendStatus(200)
    } else {
      /**
       * Todo: normalize errors (per api type?)
       */
      res.status(404).json({ 
        error: true,
        message: 'Endpoint unknown or method invalid for given endpoint',
        reference: '',
        code: 404, 
        req: req.url,
        method: req.method
      })
    }
  })

  // Use
  expressApp.use('/api', router)
}
