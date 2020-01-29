const forceMetaFields = [ 
  'payload_multisign',
  'payload_submit',
  'payload_return_url_app',
  'payload_return_url_web'
]

module.exports = (payload, response) => {
  response.meta.exists = true
  Object.keys(payload).forEach(k => {
    let section = k.split('_')[0]
    if (section == '' || forceMetaFields.indexOf(k) > -1) {
      section = 'meta'
    }
    if (typeof response[section] !== 'undefined') {
      let value = payload[k]
      if (section === 'meta' && Number.isInteger(value) && value >= 0 && value <= 1) {
        value = Boolean(value)
      }
      Object.assign(response[section], {
        [k.split('_').slice(1).join('_')]: value
      })
    }
  })

  ;['return_url_app', 'return_url_web'].forEach(metaKey => {
    if (typeof response.meta[metaKey] === 'string') {
      response.meta[metaKey] = response.meta[metaKey].replace(/\{id\}/ig, response.meta.uuid)
    }
  })

  return response
}
