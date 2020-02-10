// const log = require('debug')('app:web')

const translations = require('@src/global/translations')
const express = require('express')
const nunjucks = require('nunjucks')
const locale = require('express-locale')
const mobile = require('is-mobile')

const bodyParser = require('body-parser')

const dbExtension = require('@web/nunjucks_extensions/db')
const apiExtension = require('@web/nunjucks_extensions/api')
const qrExtension = require('@web/nunjucks_extensions/qr')
const I18nFilter = require('@web/nunjucks_extensions/i18n')

const sharp = require('sharp')
const QRCode = require('qrcode')

module.exports = async function (expressApp) {
  expressApp.use(bodyParser.urlencoded({ extended: true }))
  expressApp.use(locale({
    priority: [ 'accept-language', 'default' ],
    default: 'en_GB'
  }))
  
  /**
   * WEB Router
   */
  const router = express.Router()

  router.get(['/', '/index.html'], (req, res, next) => {
    if (req.hostname === (req.config.deeplinkRedirectLocation || '')) {
      // Do nothing, will be handled. redirectLocation doesn't serve homepage.
      return next()
    } else{
      return res.render('index.html', {
        module: 'index',
        baselocation: req.config.baselocation,
        path: req.path
      })
    }
  })

  router.get('/app/webviews/:type([a-zA-Z0-9-]+)/:language([a-zA-Z_-]+)?', (req, res, next) => {
    return res.render('webviews/' + req.params.type + '/index.html', { module: 'webviews', ...(req.params) })
  })

  router.get('/*', (req, res, next) => {
    if (req.url.match(/\.(css|png|jpg|gif|js|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'max-age=2592000, public')
    }
    Object.assign(res.locals, {
      locale: req.locale,
      baselocation: req.config.baselocation,
      mode: req.config.mode,
      appstorelinks: req.config.AppStoreLinks,
      trusted: req.ipTrusted,
      hostname: req.hostname,
      deeplinkRedirectLocation: req.config.deeplinkRedirectLocation
    })
    next()
  }, express.static('public_html'))

  const handleSignPage = (req, res, next) => {
    Object.assign(res.locals, {
      uuid: req.params.uuid || '',
      params: req.params,
      mobile: mobile({ ua: req.headers['user-agent'] || '', tablet: true }),
      is: {
        ios: (req.headers['user-agent'] || '').match(/iPhone|iPad/i),
        mac: (req.headers['user-agent'] || '').match(/Macintosh/i),
        android: (req.headers['user-agent'] || '').match(/android/i)
      },
      mode: req.config.mode
    })
    return res.render('sign.html')
  }

  /**
   * Serve sign page for deeplinkRedirection domain no matter the path, or redirect to primary domain
   */
  router.get('*', (req, res, next) => {
    if (req.hostname === (req.config.deeplinkRedirectLocation || '')) {
      // res.redirect(301, req.config.baselocation + '/sign/' + req.params.uuid + '/deeplink')
      const uuid = req.params[0].match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/)
      if (uuid && uuid.length > 0) {
        req.params.uuid = uuid[0]
        // OK, skip and next()
        return next()
      } else {
        return res.redirect(301, req.config.baselocation + (req.params[0] || ''))
      }
    }
    return next('route')
  }, handleSignPage)

  router.get('/about', (req, res, next) => {
    // throw new Error("BROKEN")
    return res.render('about.html')
  })

  router.get('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):qr(/qr)?:deeplink(/deeplink)?', handleSignPage)
  
  router.get('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):level(_[mqh])?.png', async (req, res, next) => {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', 'inline; filename=' + req.params.uuid + '.png')
    
    const qrParams = {
      _m: {
        level: 'M',
        width: 289
      },
      _q: {
        level: 'Q',
        width: 292
      },
      _h: {
        level: 'H',
        width: 318
      }
    }
    const qrimage = await new Promise((resolve, reject) => {
      QRCode.toDataURL(req.config.baselocation + '/sign/' + req.params.uuid, {
        errorCorrectionLevel: qrParams[req.params.level || '_q'].level,
        type: 'png',
        margin: 1,
        width: qrParams[req.params.level || '_q'].width,
        color: {
          light: '#ffffffff',
          dark: '#000000ff'
        }
      }, (err, url) => {
        if (err) {
          reject(err)
        } else {
          resolve(Buffer.from(url.split(',')[1], 'base64'))
        }
      })
    }).catch(r => {
      res.send(Buffer.from(req.config.qrpng, 'base64'))
    })

    if (qrimage) {
      const output = await sharp(qrimage)
        .composite([{input: Buffer.from(req.config.qrpng, 'base64'), gravity: 'centre' }])
        .png()
        .toBuffer()
      
      res.send(Buffer.from(output, 'binary'))
    }
  })

  router.get('/tx/:hash([0-9a-fA-F]{64}).json', async (req, res, next) => {
    res.setHeader('Content-Type', 'application/json')

    const qrcontents = await new Promise((resolve, reject) => {
      QRCode.toString(req.params.hash, {
        type: 'utf8', errorCorrectionLevel: 'Q'
      }, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data.split('\n').filter(r => {
            return !r.match(/^[ ]+$/)
          }).reduce((x, r) => {
            const chars = r.slice(4, -4).split('')
            let a = []
            let b = []
            for (c in chars) {
              a.push(chars[c] === '▀' || chars[c] === '█')
              b.push(chars[c] === '▄' || chars[c] === '█')
            }
            x.push(a)
            x.push(b)
            
            return x
          }, []))
        }
      })
    }).catch(r => {
      res.json({ matrix: [] })
    })

    if (qrcontents) {
      res.json({ matrix: qrcontents })
    }
  })

  router.get('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):level(_[mqh])?.json', async (req, res, next) => {
    res.setHeader('Content-Type', 'application/json')

    const qrcontents = await new Promise((resolve, reject) => {
      QRCode.toString(req.config.baselocation + '/sign/' + req.params.uuid, {
        type: 'utf8',
        errorCorrectionLevel: (req.params.level || '_q').slice(1)
      }, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data.split('\n').filter(r => {
            return !r.match(/^[ ]+$/)
          }).reduce((x, r) => {
            const chars = r.slice(4, -4).split('')
            let a = []
            let b = []
            for (c in chars) {
              a.push(chars[c] === '▀' || chars[c] === '█')
              b.push(chars[c] === '▄' || chars[c] === '█')
            }
            x.push(a)
            x.push(b)
            
            return x
          }, []))
        }
      })
    }).catch(r => {
      res.json({ matrix: [] })
    })

    if (qrcontents) {
      res.json({ matrix: qrcontents })
    }
  })

  // WEBROUTER WILDCARD - FALLBACK
  router.all('*', function(req, res){
    if ('OPTIONS' === req.method) {
      req.session.destroy()
      res.sendStatus(200)
    } else {
      res.status(404).render('404', { error: 'file not found' })
    }
  })

  // Use
  expressApp.use('/web', router)

  /**
   * Template engine
   */
  expressApp.set('view engine', 'html')

  const env = nunjucks.configure([ 'public_html', 'src/web/template' ], {
    noCache:  expressApp.config.mode === 'development',
    watch: expressApp.config.mode === 'development',
    autoescape: true,
    express: expressApp
  })

  env.addGlobal('year', (new Date()).getYear() + 1900)

  env.addExtension('api', new apiExtension(expressApp, 'web'))
  env.addExtension('db', new dbExtension(expressApp))
  env.addExtension('qr', new qrExtension())

  /**
   * Add translations i18n, read from folder with
   * translation js files.
   */
  
  env.addFilter('i18n', new I18nFilter({
    default: 'en',
    translations: translations.raw
  }))

  // /**
  //  * Testing.
  //  */
  // env.addFilter('sleep', function sleep (input, callback) {
  //   const args = Object.values(arguments).slice(1, -1)
  //   setTimeout(() => {
  //     arguments[arguments.length - 1](false, arguments[0])
  //   }, (args[0] || 1) * 1000)
  // }, true)

  env.addFilter('test', function sleep (input, callback) {
    const args = Object.values(arguments).slice(1, -1)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve([ 'a', 'b', 'c', 'd' ])
      }, (args[0] || 1) * 1000)
    }).then(results => {
      arguments[arguments.length - 1](false, results)
    })
  }, true)
}