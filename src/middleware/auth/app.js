const uuid = require('uuid/v4')

module.exports = (expressApp, req, res, apiDetails) => {
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
        user_id = :user_id,
        device_id = :device_id,
        call_uuidv4 = :call_uuidv4,
        call_uuidv4_bin = UNHEX(REPLACE(:call_uuidv4, '-', '')),
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
        call_idempotence = :call_idempotence,
        call_validauthhash = :call_validauthhash,
        call_extref = :call_extref
    `
    
    const bearer = (req.headers.authorization || '').match(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\.([0-9]+)\.([a-f0-9]{64})/i)
    if (bearer || !apiDetails.auth) {
      const findUserDetailsQuery = `
        SELECT
          u.user_uuidv4,
          u.user_id,
          u.user_slug,
          u.user_name,
          d.device_uuidv4,
          d.device_id,
          d.device_idempotence,
          SHA2(CONCAT(d.device_accesstoken, d.device_extuniqueid, :device_idempotence), 256) as __call_hash,
          IF(:device_idempotence > d.device_idempotence, 1, 0) as __call_idempotence_valid
        FROM 
          devices d
        LEFT JOIN
          users u ON (d.user_id = u.user_id)
        WHERE
          d.device_accesstoken = :device_accesstoken
        AND
          (d.device_disabled IS NULL OR d.device_disabled > NOW())
      `

      const updateUserActivityQuery = `
        UPDATE
          devices
        SET
          device_lastcall = CURRENT_TIMESTAMP,
          device_idempotence = :device_idempotence
        WHERE
          device_accesstoken = :device_accesstoken
        LIMIT 1
      `

      if (apiDetails.auth) {
        userDetails = await req.db(findUserDetailsQuery, { 
          device_accesstoken: bearer[1],
          device_idempotence: bearer[2]
        })

        if (userDetails.length > 0) {
          const hashAndIdempotencyValid = userDetails[0].__call_hash.toLowerCase() === bearer[3].toLowerCase() && userDetails[0].__call_idempotence_valid > 0

          if (hashAndIdempotencyValid || req.ipTrusted) {
            if (hashAndIdempotencyValid) {
              validAuthHash = true
            }

            req.db(updateUserActivityQuery, {
              device_accesstoken: bearer[1],
              device_idempotence: bearer[2]
            })

            resolve(Object.assign(userDetails[0], {
              call_uuidv4: call_uuidv4
            }))
          } else {
            _reject(`Invalid bearer idempotency or signature`, 830)
          }
        } else {
          _reject(`Invalid credentials`, 831)
        }
      } else {
        // NoAuth
        resolve(Object.assign({}, {
          call_uuidv4: call_uuidv4
        }))
      }
    } else {
      _reject(`No auth 'bearer' present or header incomplete`, 832, 401)
    }

    let extRef = null
    if (typeof req.params === 'object' && req.params !== null && Object.keys(req.params).length > 0) {
      if (Object.keys(req.params)[0].match(/^[a-zA-Z0-9_]+__[a-zA-Z0-9_]+$/)) {
        extRef = Object.keys(req.params)[0].split('__')[0] + '(' + req.params[Object.keys(req.params)[0]] + ')'
      }
    }

    return req.db(insertCallLogQuery, { 
      call_uuidv4: call_uuidv4,
      user_id: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].user_id : null,
      device_id: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].device_id : null,
      call_ip: req.remoteAddress,
      call_method: req.method,
      call_contenttype: req.headers['content-type'] || null,
      call_endpoint: (apiDetails.route.path || req.url).split('/')[0],
      call_url: req.url.slice(0, 64),
      call_type: apiDetails.type,
      call_version: apiDetails.version,
      call_useragent: req.headers['user-agent'] || null,
      call_httpcode: res.statusCode,
      call_ecode: typeof e !== 'undefined' ? e.code || null : null,
      call_emessage: typeof e !== 'undefined' ? e.message || null : null,
      call_idempotence: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].device_idempotence : null,
      call_validauthhash: validAuthHash,
      call_extref: extRef === null ? null : extRef.slice(0, 60)
    })
  })
}
