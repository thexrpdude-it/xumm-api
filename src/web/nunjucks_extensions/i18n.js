const nunjucks = require('nunjucks')

class I18nFilter {
  constructor (options) {
    this.options = options || {}

    if (typeof this.options.default !== 'string') {
      this.options.default = 'en'
    } else {
      this.options.default = this.options.default.toLowerCase().trim()
    }

    if (typeof this.options.translations !== 'object' || this.options.translations === null) {
      this.options.translations = {}
      Object.assign(this.options.translations, {
        [this.options.default]: {}
      })
    }

    this.call = (env, translationKey, replacements) => {
      const language = typeof env.ctx.locale === 'object' && typeof env.ctx.locale.language === 'string' ? env.ctx.locale.language.toLowerCase() : this.options.default
      const region = typeof env.ctx.locale === 'object' && typeof env.ctx.locale.region === 'string' ? '_' + env.ctx.locale.region.toLowerCase() : ''

      let autoescape = true
      if (typeof env.ctx !== 'undefined' && typeof env.ctx.opts !== 'undefined' && typeof env.ctx.opts.autoescape !== 'undefined') {
        autoescape = Boolean(env.ctx.opts.autoescape)
      }

      replacements = Object.assign(env.ctx._locals || {}, replacements)
      
      let baseText = translationKey || ''
      if (typeof this.options.translations[language + region] !== 'undefined' && typeof this.options.translations[language + region][translationKey] !== 'undefined') {
        baseText = this.options.translations[language + region][translationKey]
      } else if (typeof this.options.translations[language] !== 'undefined' && typeof this.options.translations[language][translationKey] !== 'undefined') {
        baseText = this.options.translations[language][translationKey]
      } else if (typeof this.options.translations[this.options.default] !== 'undefined' && typeof this.options.translations[this.options.default][translationKey] !== 'undefined') {
        baseText = this.options.translations[this.options.default][translationKey]
      }

      if (typeof baseText === 'string') {
        baseText = baseText.replace(/__([a-z_]+)__/g, ($, m) => {
          if (Object.keys(replacements).indexOf(m) > -1) {
            return nunjucks.runtime.suppressValue(replacements[m], autoescape)
          }
          return ''
        })
      }

      return new nunjucks.runtime.SafeString(baseText)
    }
  }
}

module.exports = I18nFilter