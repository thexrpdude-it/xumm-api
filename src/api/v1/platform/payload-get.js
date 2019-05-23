// const log = require('debug')('app:payload:get')
const getPayloadData = require('@api/v1/internal/payload-data')
const formatPayloadData = require('@api/v1/internal/payload-data-formatter')

module.exports = async (req, res) => {
  /**
   * Check if app is authorized to fetch the payload
   * because it has been created by the requesting app.
   */
  const payloadAuthInfo = await req.db(`
    SELECT 
      payloads.payload_id
    FROM 
      payloads
    WHERE
      call_uuidv4 = :call_uuidv4
    AND
      application_id = :application_id
    LIMIT 1
  `, {
    call_uuidv4: req.params.payloads__payload_id || '',
    application_id: req.__auth.application.id || ''
  })

  if (payloadAuthInfo.constructor.name === 'Array' && payloadAuthInfo.length > 0 && payloadAuthInfo[0].constructor.name === 'RowDataPacket') {
    const payload = await getPayloadData(req.params.payloads__payload_id, req.app, 'api')

    let response = {
      meta: {
        exists: false,
        uuid: null
      },
      application: {},
      payload: {},
      response: {}
    }

    if (payload) {
      req.app.redis.publish(`sign:${req.params.payloads__payload_id}`, { devapp_fetched: true })

      formatPayloadData(payload, response)
    }

    res.json(response)
    return
  }

  const e = new Error(`Payload not found`)
  e.httpCode = e.code = 404
  return res.handleError(e)
}
