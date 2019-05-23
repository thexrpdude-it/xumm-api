const log = require('debug')('app:payload-data')
const failOnDisabled = false

module.exports = async (uuid, expressApp, invoker) => {
  const db = expressApp.db

  let payloadUuid = ''
  if (typeof uuid === 'object' && uuid !== null && typeof uuid.uuid !== 'undefined') {
    payloadUuid = uuid.uuid 
  } else if (typeof uuid === 'string') {
    payloadUuid = uuid
  }

  const v4 = new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)
  if (payloadUuid.match(v4)) {
    const dbResults = await db(`
      SELECT
        applications.application_name,
        applications.application_description,
        applications.application_disabled,
        applications.application_uuidv4,
        applications.application_icon_url,
        payloads.payload_tx_type,
        payloads.payload_tx_destination,
        payloads.payload_tx_destination_tag,
        payloads.payload_request_json,
        payloads.payload_multisign,
        payloads.payload_submit,
        payloads.call_uuidv4 as _uuid,
        IF (knownaccounts.knownaccount_name IS NULL OR knownaccounts.knownaccount_name = '', payloads.payload_tx_destination, knownaccounts.knownaccount_name) as _destination,
        IF (payloads.payload_handler IS NULL, 0, 1) as _finished,
        IF (payloads.payload_expiration >= :payload_expiration, 0, 1) as _expired,
        IF (payloads.payload_expiration >= :payload_expiration, 0, 1) as _expired,
        IF (payloads.token_id IS NOT NULL, 1, 0) as _pushed,
        payloads.payload_return_url_app,
        payloads.payload_return_url_web,
        payloads.payload_response_hex as response_hex,
        payloads.payload_response_txid as response_txid,
        payloads.payload_resolved as response_resolved_at,
        payloads.payload_dispatched_to as response_dispatched_to,
        payloads.payload_dispatched_result as response_dispatched_result,
        payloads.payload_response_multisign_account as response_multisign_account,
        payloads.payload_response_account as response_account
      FROM 
        payloads
      JOIN
        applications ON (
          payloads.application_id = applications.application_id
        )
      LEFT JOIN
        knownaccounts ON (
          payloads.payload_tx_destination = knownaccounts.knownaccount_account
        )
      WHERE 
        payloads.call_uuidv4 = :call_uuidv4
      ORDER BY 
        payload_id DESC
      LIMIT 1
    `, {
      call_uuidv4: payloadUuid,
      payload_expiration: new Date()
    })

    if (dbResults.constructor.name === 'Array' && dbResults.length > 0 && dbResults[0].constructor.name === 'RowDataPacket') {
      if ([ 'web', 'app', 'ws', 'api' ].indexOf(invoker) > -1 && dbResults[0]._expired < 1) {
        // Update counters, only if requested while not expired
        db(`
          UPDATE
            payloads
          SET
            payload_${invoker}_opencount = payload_${invoker}_opencount + 1
          WHERE 
            call_uuidv4 = :call_uuidv4
          LIMIT 1
        `, {
          call_uuidv4: payloadUuid
        })
      }

      if (dbResults[0].application_disabled > 0 && failOnDisabled) {
        log(`   !! Application disabled [ ${dbResults[0].application_name} ]`, payloadUuid)
        throw new Error('Application disabled')
      } else {
        log(`   ✓ ${ dbResults[0]._expired > 0 ? '<< EXPIRED >> ' : '' }Payment Data for [ ${dbResults[0].application_name} ]`, payloadUuid)
      }

      const json = JSON.parse(dbResults[0].payload_request_json)
      if (typeof json.Memos !== 'undefined') {
        Object.assign(dbResults[0], {
          payload_computed: {
            Memos: json.Memos.map(m => {
              let r = { Memo: {} }
              if (typeof m.Memo !== 'undefined') {
                Object.keys(m.Memo).forEach(k => {
                  let value = Buffer.from(m.Memo[k], 'hex').toString('utf8')
                  r.Memo[k] = (value.length > 1 && value.match(/[a-zA-Z0-9]+/i)) ? value : m.Memo[k]
                })
              }
              return r
            })
          }
        })
      }
      return Object.assign(dbResults[0], {
        payload_request_json: json
      })
    } else {
      log('<< NO >> Payment Data for', payloadUuid)
      return false
    }
  } else {
    log('<< ERR: Invalid payload UUID >> Payment Data for', payloadUuid)
    throw new Error('Invalid payload UUID')
  }

  // await timeout(3000)
  return false
}
