// const log = require('debug')('app:payload:cancel')
const getPayload = require('@api/v1/platform/payload-get')

module.exports = async (req, res) => {
  try {
    const potentialPayload = await new Promise((resolve, reject) => {
      getPayload(req, {
        handleError (e) {
          reject(e)
        },
        json (payload) {
          resolve(payload)
        }
      })
    })

    let cancelled = false
    let reason = 'UNKNOWN'

    if (potentialPayload.meta.finished) {
      reason = 'ALREADY_RESOLVED'
    } else if (potentialPayload.meta.expired) {
      reason = 'ALREADY_EXPIRED'
    } else if (potentialPayload.meta.app_opened) {
      reason = 'ALREADY_OPENED'
    } else {
      cancelled = true
      reason = 'OK'
    }

    res.json({
      result: {
        cancelled,
        reason
      },
      meta: Object.assign(potentialPayload.meta, {
        expired: true
      })
    })

    if (cancelled === true) {
      req.db(`
        UPDATE 
          payloads
        SET
          payload_expiration = FROM_UNIXTIME(:now)
        WHERE
          call_uuidv4 = :call_uuidv4
        LIMIT 1
      `, {
        call_uuidv4: potentialPayload.meta.uuid,
        now: new Date() / 1000
      })
    }

    return
  } catch (e) {
    return res.handleError(e)    
  }
}
