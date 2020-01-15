const log = require('debug')('app:payload-api')
const logChild = log.extend('child')
const getPayloadData = require('@api/v1/internal/payload-data')
const formatPayloadData = require('@api/v1/internal/payload-data-formatter')
const codec = require('ripple-binary-codec')
const hashes = require('ripple-hashes')
const addressCodec = require('ripple-address-codec')
const uuid = require('uuid/v4')
const { fork } = require('child_process')

module.exports = async (req, res) => {
  try {
    const payload = await getPayloadData(req.params.payloads__payload_id, req.app, 'app')

    switch (req.method) {
      case 'GET':
        /**
         * Check if user is authorized to fetch the payload
         * Either because it hasn't been handled yet, or
         * becuase it has been handled by a device by the
         * requesting user.
         */
        const payloadAuthInfo = await req.db(`
          SELECT 
            payloads.payload_id,
            IF(payloads.payload_handler IS NULL, NULL, (
              SELECT
                user_id
              FROM
                devices
              WHERE
                devices.device_id = payloads.payload_handler
              LIMIT 1
            )) as __payload_handler_user_id,
            (SELECT application_uuidv4 FROM applications WHERE applications.application_id = payloads.application_id) as application_uuidv4
          FROM 
            payloads
          WHERE
            call_uuidv4 = :call_uuidv4
          LIMIT 1
        `, {
          call_uuidv4: req.params.payloads__payload_id || ''
        })
      
        if (payloadAuthInfo.constructor.name === 'Array' && payloadAuthInfo.length > 0 && payloadAuthInfo[0].constructor.name === 'RowDataPacket') {
          if (payloadAuthInfo[0].__payload_handler_user_id === null || payloadAuthInfo[0].__payload_handler_user_id === req.__auth.user.id) {
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
              req.app.redis.publish(`sign:${req.params.payloads__payload_id}`, { opened: true })

              req.app.redis.publish(`app:${payloadAuthInfo[0].application_uuidv4}`, {
                call: req.params.payloads__payload_id,
                endpoint: 'payload',
                type: 'app',
                method: req.method
              })
    
              response = formatPayloadData(payload, response)
            }
    
            return res.json(response)
          }
        }
  
        const e = new Error(`Payload handled by another client`)
        e.httpCode = e.code = 403
        res.handleError(e)
      
        break;
      case 'PATCH':
        if (payload) {
          let response = {
            payload_uuidv4: req.params.payloads__payload_id,
            reference_call_uuidv4: req.__auth.call.uuidv4,
            signed: false,
            user_token: false,
            return_url: {
              app: null,
              web: null
            }
          }

          /**
           * For callback (webhook) to app
           */
          let generatedAccessToken

          if (payload.response_resolved_at !== null) {
            const e = new Error(`Payload already resolved`)
            e.httpCode = e.code = 409
            throw e
          }

          if (payload._expired > 0) {
            const e = new Error(`Payload expired`)
            e.httpCode = e.code = 510
            throw e
          }

          if (payload._finished > 0) {
            const e = new Error(`Payload already signed`)
            e.httpCode = e.code = 511
            throw e
          }
          
          let transactionResults = {
            valid: true,
            message: `Input transaction couldn't be parsed`
          }

          const payloadUpdate = {
            payload_handler: req.__auth.device.id,
            response_hex: '',
            response_txid: '',
            response_account: '',
            tx_account: '',
            multisign_account: '',
            resolved: new Date(),
            dispatched_to: '',
            dispatched_result: '',
            rejected: false
          }
          
          if (typeof req.body === 'object' && req.body !== null) {
            if (typeof req.body.reject !== 'undefined' && (req.body.reject === true || req.body.reject === 'true' || req.body.reject === 1)) {
              // Rejected tx.
              payloadUpdate.rejected = true
            } else {
              if (typeof req.body.tx_id === 'string' && req.body.tx_id.match(/^[A-F0-9]+$/)) {
                // TODO: ??? validate tx_id ID and compare with signed_blob
                payloadUpdate.response_txid = req.body.tx_id
              } else {
                const e = new Error(`Invalid transaction id (tx_id)`)
                e.httpCode = e.code = 802
                throw e
              }
              if (typeof req.body.signed_blob === 'string' && req.body.signed_blob.match(/^[A-F0-9]+$/)) {
                try {
                  const tx = codec.decode(req.body.signed_blob)
                  payloadUpdate.response_hex = req.body.signed_blob

                  const id = hashes.computeBinaryTransactionHash(req.body.signed_blob)
                  if (payloadUpdate.response_txid !== id) {
                    const e = new Error(`Transaction id mismatch (tx_id: != binary transaction hash)`)
                    e.httpCode = e.code = 803
                    throw e    
                  }

                  if (Object.keys(tx).indexOf('Account') > -1) {
                    payloadUpdate.response_account = tx.Account  
                  }
                }
                catch (_e) {
                  const e = new Error(`Transaction blob decode error (signed_blob: ${_e.message})`)
                  e.httpCode = e.code = 801
                  throw e
                }
              } else {
                const e = new Error(`Invalid or missing signed transaction blob (signed_blob)`)
                e.httpCode = e.code = 800
                throw e
              }
            }

            if (typeof req.body.permission === 'object' && req.body.permission !== null) {
              if (typeof req.body.permission.push !== 'undefined') {
                if (req.body.permission.push === true || req.body.permission.push === 'true' || req.body.permission.push === 1 || req.body.permission.push === '1') {
                  const tokenExpiry = new Date()
                  let days
                  if (typeof req.body.permission.days !== 'undefined') {
                    days = parseInt(req.body.permission.days)
                  }
                  if (typeof days === 'undefined' || isNaN(days) || days < 7) {
                    days = 90
                  }
                  tokenExpiry.setTime(tokenExpiry.getTime() + 24 * 60 * 60 * days * 1000)

                  generatedAccessToken = {
                    user_id: req.__auth.user.id,
                    token_issued: new Date(),
                    token_expiration: tokenExpiry,
                    token_accesstoken: uuid(),
                    call_uuidv4: res.get('X-Call-Ref'),
                    payload_uuidv4: req.params.payloads__payload_id,
                    application_uuidv4: payload.application_uuidv4,
                    token_days_valid: days
                  }

                  const accessTokenInsert = await req.db(`
                    INSERT INTO
                      tokens
                    SET 
                      user_id = :user_id,
                      token_issued = FROM_UNIXTIME(:token_issued),
                      token_expiration = FROM_UNIXTIME(:token_expiration),
                      token_accesstoken = :token_accesstoken,
                      call_uuidv4 = :call_uuidv4,
                      payload_uuidv4 = :payload_uuidv4,
                      application_id = (SELECT application_id FROM applications WHERE application_uuidv4 = :application_uuidv4 LIMIT 1),
                      token_days_valid = :token_days_valid,
                      token_hidden = 0
                    ON DUPLICATE KEY UPDATE
                      token_expiration = DATE_ADD(FROM_UNIXTIME(:token_issued), INTERVAL token_days_valid DAY),
                      call_uuidv4 = :call_uuidv4,
                      payload_uuidv4 = :payload_uuidv4,
                      token_hidden = 0
                  `, { 
                    ...generatedAccessToken,
                    token_issued: generatedAccessToken.token_issued / 1000,
                    token_expiration: generatedAccessToken.token_expiration / 1000
                  })

                  if (accessTokenInsert.constructor.name !== 'OkPacket' || typeof accessTokenInsert.insertId === 'undefined' || !(accessTokenInsert.insertId > 0)) {
                    const e = new Error(`Could not persist access token`)
                    throw e
                  } else {
                    response.user_token = true
                  }
                }
              }
            }

            if (!response.user_token) {
              /**
               * No access token set/generated/... -- Fetch and extend possible existing token
               */
              const accessTokenGet = await req.db(`
                SELECT
                  *
                FROM
                  tokens
                WHERE
                  token_hidden = 0
                AND
                  token_expiration > FROM_UNIXTIME(:now)
                AND
                  application_id = (SELECT application_id FROM applications WHERE application_uuidv4 = :application_uuidv4 LIMIT 1)
                LIMIT 1
              `, {
                now: new Date() / 1000,
                application_uuidv4: payload.application_uuidv4
              })

              /**
               * Token found? Update token with new expiration date and return token to callback endpoint
               */
              if (Array.isArray(accessTokenGet) && accessTokenGet.length > 0 && accessTokenGet[0].constructor.name === 'RowDataPacket') {
                const tokenExpiry = new Date()
                tokenExpiry.setTime(tokenExpiry.getTime() + 24 * 60 * 60 * accessTokenGet[0].token_days_valid * 1000)

                generatedAccessToken = {
                  user_id: req.__auth.user.id,
                  token_accesstoken: accessTokenGet[0].token_accesstoken,
                  token_issued: accessTokenGet[0].token_issued,
                  token_expiration: tokenExpiry,
                  call_uuidv4: res.get('X-Call-Ref'),
                  payload_uuidv4: req.params.payloads__payload_id,
                  application_uuidv4: payload.application_uuidv4,
                  token_days_valid: accessTokenGet[0].token_days_valid
                }

                const accessTokenUpdate = await req.db(`
                  UPDATE
                    tokens
                  SET 
                    token_expiration = FROM_UNIXTIME(:token_expiration),
                    call_uuidv4 = :call_uuidv4,
                    payload_uuidv4 = :payload_uuidv4,
                    token_hidden = 0
                  WHERE
                    token_accesstoken = :token_accesstoken
                `, { 
                  ...generatedAccessToken,
                  token_expiration: generatedAccessToken.token_expiration / 1000
                })

                if (accessTokenUpdate.constructor.name !== 'OkPacket' || typeof accessTokenUpdate.changedRows === 'undefined' || !(accessTokenUpdate.changedRows > 0)) {
                  const e = new Error(`Could not persist (updated) access token`)
                  throw e
                } else {
                  response.user_token = true
                }
              }
            }

            if (typeof req.body.dispatched === 'object' && req.body.dispatched !== null) {
              if (typeof req.body.dispatched.to === 'string' && req.body.dispatched.to.match(/^w[s]{1,2}:\/\//)) {
                payloadUpdate.dispatched_to = req.body.dispatched.to
              }
              if (typeof req.body.dispatched.result === 'string' && req.body.dispatched.result.match(/[a-zA-Z0-9]+/)) {
                payloadUpdate.dispatched_result = req.body.dispatched.result
              }
            }
            if (typeof req.body.multisigned === 'string' && req.body.multisigned.match(/^r[a-zA-Z0-9]{20,35}$/)) {
              if (addressCodec.isValidClassicAddress(req.body.multisigned)) {
                payloadUpdate.multisign_account = req.body.multisigned
              } else {
                const e = new Error(`Invalid MultiSign account (multisigned)`)
                e.httpCode = e.code = 804
                throw e  
              }
            }
          }

          if (!transactionResults.valid) {
            const e = new Error(`Invalid payload result: ${transactionResults.message}`)
            e.httpCode = e.code = 403
            throw e
          } else {
            response.signed = !payloadUpdate.rejected
            response.return_url = {
              app: payload.payload_return_url_app === null ? null : payload.payload_return_url_app.replace(/\{id\}/, req.params.payloads__payload_id),
              web: payload.payload_return_url_web === null ? null : payload.payload_return_url_web.replace(/\{id\}/, req.params.payloads__payload_id)
            }

            req.app.redis.publish(`sign:${req.params.payloads__payload_id}`, response)
            
            req.app.redis.publish(`app:${payload.application_uuidv4}`, {
              call: req.params.payloads__payload_id,
              endpoint: 'payload',
              type: 'app',
              method: req.method
            })

            const update = await req.db(`
              UPDATE
                payloads
              SET
                payloads.payload_response_hex = :payload_response_hex,
                payloads.payload_response_txid = :payload_response_txid,
                payloads.payload_response_multisign_account = :multisign_account,
                payloads.payload_tx_account = :payload_tx_account,
                payloads.payload_resolved = FROM_UNIXTIME(:payload_resolved),
                payloads.payload_dispatched_to = :payload_dispatched_to,
                payloads.payload_dispatched_result = :payload_dispatched_result,
                payloads.payload_response_account = :response_account,
                payloads.payload_handler = :payload_handler
              WHERE
                payloads.call_uuidv4 = :payload_uuidv4
              AND
                payloads.payload_resolved IS NULL
              LIMIT 1
            `, {
              payload_uuidv4: req.params.payloads__payload_id,
              payload_response_hex: payloadUpdate.response_hex,
              payload_response_txid: payloadUpdate.response_txid,
              multisign_account: payloadUpdate.multisign_account,
              payload_tx_account: payloadUpdate.tx_account,
              payload_resolved: payloadUpdate.resolved / 1000,
              payload_dispatched_to: payloadUpdate.dispatched_to,
              payload_dispatched_result: payloadUpdate.dispatched_result,
              response_account: payloadUpdate.response_account,
              payload_handler: payloadUpdate.payload_handler,
            })

            if (update.constructor.name !== 'OkPacket' || typeof update.changedRows === 'undefined' || !(update.changedRows > 0)) {
              const e = new Error(`Payload couldn't be updated`)
              throw e
            }
          }

          res.json(response)

          const appDetails = await req.db(`
            SELECT
              applications.application_webhookurl,
              tokens.token_accesstoken
            FROM
              applications
            LEFT JOIN
              tokens ON (
                tokens.user_id = :user_id
              AND
                tokens.application_id = applications.application_id
              )
            WHERE
              application_uuidv4 = :application_uuidv4
            LIMIT 1
          `, {
            application_uuidv4: payload.application_uuidv4,
            user_id: req.__auth.user.id
          })

          if (Array.isArray(appDetails) && appDetails.length > 0 && appDetails[0].constructor.name === 'RowDataPacket') {
            const callbackUrl = appDetails[0].application_webhookurl
            if (callbackUrl.match(/^https:/)) {
              const callbackData = {
                meta: {
                  url: callbackUrl,
                  application_uuidv4: payload.application_uuidv4,
                  payload_uuidv4: req.params.payloads__payload_id
                },
                payloadResponse: response,
                accessToken: !response.user_token ? null : { 
                  token_issued: generatedAccessToken.token_issued,
                  token_expiration: generatedAccessToken.token_expiration,
                  token_accesstoken: appDetails[0].token_accesstoken || generatedAccessToken.token_accesstoken
                }
              }

              const child = fork('src/fork/payloadCallback.js')

              child.on('message', msg => {
                // log(`${req.params.payloads__payload_id}: Message from payload callback child`, msg)
                if (typeof msg.debug_log !== 'undefined') {
                  logChild.apply(null, Object.values(msg.debug_log))
                }
                if (typeof msg.pid !== 'undefined') {
                  /**
                   * Initial message with PID, child is ready.
                   * Deliver data.
                   */
                  child.send(callbackData)
                }
              })

              child.on('exit', (code, signal) => {
                logChild(`${req.params.payloads__payload_id}: Child process exited with code [ ${code} ]`) // and signal ${signal}
              })
            }
          }
        } else {
          const e = new Error('Payload not found')
          e.httpCode = e.code = 404
          throw e
        }

        break;
    }
  } catch (e) {
    res.handleError(e)
  }
}
