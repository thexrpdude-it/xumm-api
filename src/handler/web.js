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
    return res.render('index.html', { module: 'index' })
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
      trusted: req.ipTrusted
    })
    next()
  }, express.static('public_html'))

  router.get('/about', (req, res, next) => {
    // throw new Error("BROKEN")
    return res.render('about.html')
  })

  router.get('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}):qr(/qr)?', (req, res, next) => {
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