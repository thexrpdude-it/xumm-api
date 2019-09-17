const fs = require('fs')
const I18nFilter = require('@web/nunjucks_extensions/i18n')

const files = fs.readdirSync(__dirname + '/../web/translations/')
let translations = []
files.filter(f => {
  return f.match(/^([a-z]{2}|[a-z]{2}_[a-z]{2})\.js$/i)
}).forEach(f => {
  translations[f.slice(0, -3).toLowerCase()] = require('@src/web/translations/' + f.slice(0, -3))
})

module.exports = {
  raw: translations,
  translate (language, key, replacements) {
    const filter = new I18nFilter({
      default: 'en',
      translations: translations
    })

    return filter.call({
      ctx: {
        locale: {
          language: language.split('_')[0],
          region: language.split('_')[1]
        }
      }
    }, key, replacements).val
  }
}
