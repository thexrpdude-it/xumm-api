const uuid = require('uuid/v4')

module.exports = (expressApp, req, res, apiDetails) => {
  // console.log('<< API: APP AUTH (CUSTOM, TOKEN, HEADERS) MIDDLEWARE >>')
  return new Promise(async (resolve, reject) => {
    const call_uuidv4 = uuid()
    res.set('X-Call-Ref', call_uuidv4)

    let e
    let userDetails

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
        call_emessage = :call_emessage
    `
    
    const bearer = req.headers.authorization.match(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/i)
    if (bearer) {
      const findUserDetailsQuery = `
        SELECT
          u.user_uuidv4,
          u.user_id,
          u.user_slug,
          u.user_name,
          d.device_uuidv4,
          d.device_id
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
          device_lastcall = CURRENT_TIMESTAMP
        WHERE
          device_accesstoken = :device_accesstoken
        LIMIT 1
      `

      userDetails = await req.db(findUserDetailsQuery, { 
        device_accesstoken: bearer[1]
      })

      if (userDetails.length > 0) {
        req.db(updateUserActivityQuery, { 
          device_accesstoken: bearer[1]
        })

        resolve(Object.assign(userDetails[0], {
          call_uuidv4: call_uuidv4
        }))
      } else {
        e = new Error(`Invalid credentials`)
        Object.assign(e, { code: 801 })
        console.log(`ERROR @ ${req.ip} ${call_uuidv4} - ${e.message}`)
        res.status(403).json({
          error: {
            reference: call_uuidv4,
            code: e.code || null
          }
        })
        reject(e)
      }
    } else {
      e = new Error(`No auth 'bearer' present`)
      Object.assign(e, { code: 800 })
      console.log(`ERROR @ ${req.ip} ${call_uuidv4} - ${e.message}`)
      res.status(401).json({
        error: {
          reference: call_uuidv4,
          code: e.code || null
        }
      })
      reject(e)
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
      call_emessage: typeof e !== 'undefined' ? e.message || null : null
    })
  })
}
