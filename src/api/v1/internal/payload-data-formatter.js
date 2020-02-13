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
      const assignKey = k.split('_').slice(1).join('_')
      if (assignKey === 'custom_blob' && value !== null) {
        try {
          value = JSON.parse(value)
        } catch (e) {
          value = null
        }
      }
      Object.assign(response[section], {
        [assignKey]: value
      })
    }
  })

  ;['return_url_app', 'return_url_web'].forEach(metaKey => {
    if (typeof response.meta[metaKey] === 'string') {
      /**
       * TODO: Duplicate replacement: src/api/v1/app/payload.js
       */
      response.meta[metaKey] = response.meta[metaKey]
        .replace(/\{id\}/ig, response.meta ? (response.meta.uuid || '') : '')
        .replace(/\{txid\}/i, response.response ? (response.response.txid || '') : '')
        .replace(/\{txblob\}/i, response.response ? (response.response.hex || '') : '')
        .replace(/\{cid\}/i, encodeURIComponent(response.meta ? (response.meta.custom_identifier || '') : ''))
    }
  })

  return response
}
