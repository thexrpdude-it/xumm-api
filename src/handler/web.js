const fs = require('fs')
const express = require('express')
const nunjucks = require('nunjucks')
const locale = require('express-locale')

const bodyParser = require('body-parser')

const qrExtension = require('./nunjucks_extensions/qr')
const dbExtension = require('./nunjucks_extensions/db')
const I18nFilter = require('./nunjucks_extensions/i18n')

module.exports = async function (expressApp) {
  require('express-ws')(expressApp)

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

  router.ws('/', (ws, req) => {
    ws.on('message', (msg) => {
      console.log('Got WS Message', msg)
      ws.send('Right back at  you')
    })
  })

  router.get('/*', (req, res, next) => {
    if (req.url.match(/\.(css|png|jpg|gif|js|ico)$/)) {
      res.setHeader('Cache-Control', 'max-age=2592000, public')
    }
    Object.assign(res.locals, {
      locale: req.locale,
      appname: 'SuperCoolApp'
    })
    next()
  }, express.static('public_html'))

  router.get('/about', (req, res, next) => {
    // throw new Error("BROKEN")
    return res.render('about.html')
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

  env.addExtension('db', new dbExtension(expressApp))
  env.addExtension('qr', new qrExtension())

  /**
   * Add translations i18n, read from folder with
   * translation js files.
   */
  fs.readdir('./src/web/translations/', (err, files) => {
    let translations = []
    files.filter(f => {
      return f.match(/^([a-z]{2}|[a-z]{2}_[a-z]{2})\.js$/i)
    }).forEach(f => {
      translations[f.slice(0, -3).toLowerCase()] = require('../web/translations/' + f.slice(0, -3))
    })
    env.addFilter('i18n', new I18nFilter({
      default: 'en',
      translations: translations
    }))
  })

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