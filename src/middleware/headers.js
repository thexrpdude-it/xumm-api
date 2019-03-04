const helmet = require('helmet')

module.exports = async (expressApp) => {
  expressApp.disable('x-powered-by')
  expressApp.use(helmet({
    referrerPolicy: { 
      policy: 'same-origin'
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [ "'self'" ].concat(expressApp.config.resources.default || []),
        styleSrc: [ "'self'" ].concat(expressApp.config.resources.styles || []),
        imgSrc: [ "'self'" ].concat(expressApp.config.resources.images || []),
        fontSrc: [ "'self'" ].concat(expressApp.config.resources.fonts || [])
      }
    }
  }))
}
