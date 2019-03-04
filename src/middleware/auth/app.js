const uuid = require('uuid/v4')


module.exports = (expressApp, req, res, apiDetails) => {
  // console.log('<< API: APP AUTH (CUSTOM, TOKEN, HEADERS) MIDDLEWARE >>')
  return new Promise(async (resolve, reject) => {
    const call_uuidv4 = uuid()
    res.set('X-Call-Ref', call_uuidv4)

    let e
    let userDetails
    let validAuthHash = false

    const _reject = (message, code, httpCode) => {
      e = new Error(message)
      Object.assign(e, { code: code })
      console.log(`ERROR @ ${req.ip} ${call_uuidv4} - ${e.message}`)
      res.status(typeof httpCode === 'undefined' || !isNaN(parseInt(httpCode)) ? 403 : parseInt(httpCode)).json({
        error: {
          reference: call_uuidv4,
          code: e.code || null
        }
      })
      reject(e)
    }

    const insertCallLogQuery = `
      INSERT INTO 
        calls
      SET
        user_id = :user_id,
        device_id = :device_id,
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
        call_idempotence = :call_idempotence,
        call_validauthhash = :call_validauthhash
    `
    
    const bearer = req.headers.authorization.match(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\.([0-9]+)\.([a-f0-9]{64})/i)
    if (bearer) {
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
          _reject(`Invalid bearer idempotency or signature`, 802)
        }
      } else {
        _reject(`Invalid credentials`, 801)
      }
    } else {
      _reject(`No auth 'bearer' present or header incomplete`, 800, 401)
    }

    return req.db(insertCallLogQuery, { 
      call_uuidv4: call_uuidv4,
      user_id: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].user_id : null,
      device_id: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].device_id : null,
      call_ip: req.remoteAddress,
      call_method: req.method,
      call_contenttype: req.headers['content-type'] || null,
      call_endpoint: apiDetails.route.path || req.url,
      call_url: req.url,
      call_type: apiDetails.type,
      call_version: apiDetails.version,
      call_useragent: req.headers['user-agent'] || null,
      call_httpcode: res.statusCode,
      call_ecode: typeof e !== 'undefined' ? e.code || null : null,
      call_emessage: typeof e !== 'undefined' ? e.message || null : null,
      call_idempotence: typeof userDetails !== 'undefined' && userDetails.length > 0 ? userDetails[0].device_idempotence : null,
      call_validauthhash: validAuthHash
    })
  })
}
