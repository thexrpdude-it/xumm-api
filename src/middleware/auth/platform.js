const uuid = require('uuid/v4')
const log = require('debug')('app:platform')

module.exports = (expressApp, req, res, apiDetails) => {
  // log('<< API: APP AUTH (CUSTOM, TOKEN, HEADERS) MIDDLEWARE >>')
  return new Promise(async (resolve, reject) => {
    const call_uuidv4 = uuid()
    res.set('X-Call-Ref', call_uuidv4)

    let e
    let userDetails
    let validAuthHash = false

    const _reject = (message, code, httpCode) => {
      e = new Error(message)
      Object.assign(e, { 
        code: code, 
        httpCode: typeof httpCode === 'undefined' || !isNaN(parseInt(httpCode)) ? 403 : parseInt(httpCode) 
      })
      res.handleError(e)
      reject(e)
    }

    const insertCallLogQuery = `
      INSERT INTO 
        calls
      SET
        application_id = :application_id,
        call_uuidv4 = :call_uuidv4,
        call_moment = CURRENT_TIMESTAMP,
        call_ip = :call_ip,
        call_method = :call_method,
        call_contenttype = :call_contenttype,
        call_endpoint = :call_endpoint,
        call_url = :call_url,
        call_type = :call_type,
        call_version = :call_version,
        call_useragent = :call_useragent,
        call_httpcode = :call_httpcode,
        call_ecode = :call_ecode,
        call_emessage = :call_emessage,
        call_extref = :call_extref
    `
    
    const apiKey = (req.headers['x-api-key'] || '').trim().match(/^([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i)
    const apiSecret = (req.headers['x-api-secret'] || '').trim().match(/^([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$/i)
    if ((apiKey && apiSecret) || !apiDetails.auth) {
      const findAppDetailsQuery = `
        SELECT
          a.application_id,
          a.application_uuidv4,
          a.application_name,
          a.application_webhookurl,
          a.application_disabled
        FROM 
          applications a
        WHERE
          a.application_uuidv4 = :api_key
        AND
          a.application_secret = :api_secret
      `

      const updateAppActivityQuery = `
        UPDATE
        applications
        SET
          application_lastcall = CURRENT_TIMESTAMP
        WHERE
          application_uuidv4 = :api_key
        LIMIT 1
      `
      if (apiDetails.auth) {
        appDetails = await req.db(findAppDetailsQuery, { api_key: apiKey[0], api_secret: apiSecret[0] })

        if (appDetails.length > 0) {
          if (appDetails[0].application_disabled < 1) {
            req.db(updateAppActivityQuery, { api_key: apiKey[0] })

            resolve(Object.assign(appDetails[0], {
              call_uuidv4: call_uuidv4
            }))
          } else {
            _reject(`Application disabled`, 802, 401)
          }
        } else {
          _reject(`Invalid 'X-API-Key' / 'X-API-Secret' credentials`, 801)
        }
      } else {
        // NoAuth
        resolve(Object.assign({}, {
          call_uuidv4: call_uuidv4
        }))
      }
    } else {
      _reject(`No auth 'X-API-Key' / 'X-API-Secret' headers present or malformed`, 800, 401)
    }

    let extRef = null
    if (typeof req.params === 'object' && req.params !== null && Object.keys(req.params).length > 0) {
      if (Object.keys(req.params)[0].match(/^[a-zA-Z0-9_]+__[a-zA-Z0-9_]+$/)) {
        extRef = Object.keys(req.params)[0].split('__')[0] + '(' + req.params[Object.keys(req.params)[0]] + ')'
      }
    }

    res.dbLogLine = req.db(insertCallLogQuery, { 
      call_uuidv4: call_uuidv4,
      application_id: typeof appDetails !== 'undefined' && appDetails.length > 0 ? appDetails[0].application_id : null,
      call_ip: req.remoteAddress,
      call_method: req.method,
      call_contenttype: req.headers['content-type'] || null,
      call_endpoint: (apiDetails.route.path || req.url).split('/')[0],
      call_url: req.url,
      call_type: apiDetails.type,
      call_version: apiDetails.version,
      call_useragent: req.headers['user-agent'] || null,
      call_httpcode: res.statusCode,
      call_ecode: typeof e !== 'undefined' ? e.code || null : null,
      call_emessage: typeof e !== 'undefined' ? e.message || null : null,
      call_extref: extRef === null ? null : extRef.slice(0, 60)
    })

    return res.dbLogLine
  })
}
