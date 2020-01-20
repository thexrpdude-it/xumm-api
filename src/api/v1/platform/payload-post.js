const codec = require('ripple-binary-codec')
const accountlib = require('xrpl-accountlib')
const knownAccount = require('@api/v1/internal/known-account-hydrate')
const resolveAccount = require('@api/v1/internal/known-account-resolve')
const log = require('debug')('app:payload:post')
const logChild = log.extend('child')
const { fork } = require('child_process')

module.exports = async (req, res) => {
  const uuidv4_format = new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)
  
  let pushed = false
  let pushToken

  let tx = {
    hex: '',
    json: {},
    error: null
  }

  let options = {
    multisign: false,
    submit: true,
    expire: 24,
    return_url_app: null,
    return_url_web: null
  }

  const checkTxValid = (txjson) => {
    const validTransactionTypes = {
      TransactionType: [ 
        'Payment',
        'OfferCreate',
        'OfferCancel',
        'EscrowFinish',
        'EscrowCreate',
        'EscrowCancel',
        'DepositPreauth',
        'CheckCreate',
        'CheckCash',
        'CheckCancel',
        'AccountSet',
        'PaymentChannelCreate',
        'PaymentChannelFund',
        'SetRegularKey',
        'SignerListSet',
        'TrustSet',
        'EnableAmendment',
        'SetFee',
        // Pseudo Types
        'SignIn'
      ],
      Channel: []
    }

    let txValid = false
    Object.keys(validTransactionTypes).forEach(k => {
      if (!txValid) {
        const possibleValues = validTransactionTypes[k]
        if (possibleValues.length === 0) {
          txValid = typeof txjson[k] !== 'undefined'
        } else {
          txValid = typeof txjson[k] === 'string' && possibleValues.indexOf(txjson[k]) > -1
        }
      }
    })

    if (!txValid) {
      tx.error = new Error('Invalid XRPL transaction')
      tx.error.causingError = new Error('Transaction not meeting TransactionType / Channel requirements')
      tx.error.code = 602
    }

    return txValid
  }

  if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
    if (typeof req.body.txjson === 'object' && typeof req.body.txblob === 'string') {
      tx.error = new Error('Ambiguous payload, please specify either txblob or txjson')
      tx.error.code = 604
    } else if (typeof req.body.txblob === 'string' && req.body.txblob.match(/^[A-F0-9]{10,}$/)) {
      try {
        const json = codec.decode(req.body.txblob.trim())
        if (checkTxValid(json)) {
          accountlib.sign(json, accountlib.derive.passphrase('masterpassphrase'))
          tx.hex = req.body.txblob.trim()
          tx.json = json
        }
      } catch (e) {
        tx.error = new Error('Payload HEX blob decoding error')
        tx.error.causingError = e
        tx.error.code = 601
      }
    } else if (typeof req.body.txjson === 'object') {
      if (checkTxValid(req.body.txjson)) {
        try {
          const txjson = {}
          if (Object.keys(req.body.txjson).indexOf('TransactionType') > -1 && req.body.txjson.TransactionType.toLowerCase() === 'signin') {
            Object.assign(txjson, {
              SignIn: true
            })
          } else {
            Object.assign(txjson, req.body.txjson)
          }
          const signed = accountlib.sign(txjson, accountlib.derive.passphrase('masterpassphrase'))
          tx.hex = signed.signedTransaction
          tx.json = req.body.txjson
        } catch (e) {
          tx.error = new Error('Payload JSON transaction encoding error')
          tx.error.causingError = e
          tx.error.code = 603
        }
      }
    } else {
      tx.error = new Error('Payload body missing txblob or txjson transaction data')
      tx.error.code = 600
    }
  } else {
    tx.error = new Error('Payload body invalid')
    tx.error.code = 599
  }

  /**
   * Now continue
   */

  try {
    if (tx.error !== null) {
      tx.error = {
        message: tx.error.toString(),
        causingError: typeof tx.error.causingError === 'object' ? tx.error.causingError.message || '' : null,
        code: tx.error.code || 0,
        auth: req.__auth
      }

      /**
       * Handle API response
       *   > Logging is already done by the API error handler
       */
      throw tx.error
    } else {
      const uuid = res.get('X-Call-Ref') || null
      if (uuid === null) {
        throw Object.assign(new Error('Payload call reference error'), { code: 605 })
      }      

      if (Object.keys(req.body).indexOf('options') > -1 && typeof req.body.options === 'object' && req.body.options !== null) {
        ['submit', 'multisign'].forEach(optionBoolType => {
          if (typeof req.body.options[optionBoolType] !== 'undefined') {
            if (typeof req.body.options[optionBoolType] === 'boolean') {
              req.body.options[optionBoolType] = req.body.options[optionBoolType] ? 1 : 0
            }
            if (typeof req.body.options[optionBoolType] === 'number') {
              options[optionBoolType] = parseInt(req.body.options[optionBoolType]) > 0 ? 1 : 0
            }
            if (typeof req.body.options[optionBoolType] === 'string') {
              if (req.body.options[optionBoolType].toLowerCase().trim() === 'true') {
                options[optionBoolType] = 1
              } else if (req.body.options[optionBoolType].toLowerCase().trim() === 'false') {
                options[optionBoolType] = 0
              } else {
                options[optionBoolType] = parseInt(req.body.options[optionBoolType]) > 0 ? 1 : 0
              }
            }
          }
        })

        if (typeof req.body.options.expire !== 'undefined') {
          if (typeof req.body.options.expire === 'number' || typeof req.body.options.expire === 'string') {
            options.expire = parseInt(req.body.options.expire) > 0 ? parseInt(req.body.options.expire) : 24
          }
        }
        if (typeof req.body.options.return_url === 'object' && req.body.options.return_url !== null) {
          if (typeof req.body.options.return_url.app === 'string' ) {
            options.return_url_app = req.body.options.return_url.app.trim()
            //.replace(/{id}/, uuid)
          }
          if (typeof req.body.options.return_url.web === 'string' ) {
            options.return_url_web = req.body.options.return_url.web.trim()
            //.replace(/{id}/, uuid)
          }
        }
        if (typeof req.body.user_token !== 'undefined' && req.body.user_token.match(uuidv4_format)) {
          pushToken = await req.db(`
            SELECT 
              devices.device_pushtoken,
              applications.application_name,
              tokens.token_id
            FROM 
              tokens
            JOIN
              users ON (
                tokens.user_id = users.user_id
              )
            JOIN
              devices ON (
                devices.user_id = users.user_id
              )
            JOIN
              applications ON (
                applications.application_id = tokens.application_id
              )
            WHERE
              token_accesstoken = :token_accesstoken
            AND
              token_hidden = 0
            AND
              token_expiration >= FROM_UNIXTIME(:token_expiration)
            AND
              devices.device_disabled IS NULL
            AND
              devices.device_accesstoken IS NOT NULL
            AND
              devices.device_pushtoken IS NOT NULL
            AND
              devices.device_lockedbydeviceid IS NULL
            ORDER BY
              devices.device_lastcall DESC
          `, {
            token_accesstoken: req.body.user_token,
            token_expiration: new Date() / 1000
          })

          if (pushToken.constructor.name === 'Array' && pushToken.length > 0 && pushToken[0].constructor.name === 'RowDataPacket') {
            pushed = true
          }
        }
      }

      const payloadMoment = new Date()
      let payloadExpiry = new Date()
      payloadExpiry.setTime(payloadMoment.getTime() + 60 * 60 * options.expire * 1000)

      if (typeof tx.json.Destination === 'string') {
        try {
          knownAccount(req.db, tx.json.Destination)
        } catch (e) {
          log('PAYLOAD <Destination lookup error>', e)
        }
      }

      const payloadInsertQuery = `
        INSERT IGNORE INTO 
          payloads 
        SET 
          application_id = :application_id,
          call_uuidv4 = :call_uuidv4,
          -- payload_request_hex = :payload_request_hex,
          payload_request_json = :payload_request_json,
          payload_tx_type = :payload_tx_type,
          payload_tx_account = :payload_tx_account,
          payload_tx_destination = :payload_tx_destination,
          payload_tx_destination_tag = :payload_tx_destination_tag,
          payload_created = FROM_UNIXTIME(:payload_created),
          payload_expiration = FROM_UNIXTIME(:payload_expiration),
          payload_multisign = :payload_multisign,
          payload_submit = :payload_submit,
          payload_return_url_app = :payload_return_url_app,
          payload_return_url_web = :payload_return_url_web,
          token_id = :token_id
      `

      const db = await req.db(payloadInsertQuery, {
        application_id: req.__auth.application.id,
        call_uuidv4: uuid,
        // payload_request_hex: tx.hex,
        payload_request_json: JSON.stringify(tx.json),
        payload_tx_type: tx.json.TransactionType,
        payload_tx_account: tx.json.Account || '',
        payload_tx_destination: tx.json.Destination || '',
        payload_tx_destination_tag: tx.json.DestinationTag || null,
        payload_created: payloadMoment / 1000,
        payload_expiration: payloadExpiry / 1000,
        payload_multisign: options.multisign,
        payload_submit: options.submit,
        payload_return_url_app: options.return_url_app,
        payload_return_url_web: options.return_url_web,
        token_id: pushed ? pushToken[0].token_id : null
      })

      if (typeof db !== 'object' || typeof db.insertId !== 'number' || db.insertId < 1) {
        throw Object.assign(new Error('Payload increment error'), { code: 605 })
      }
      if (typeof req.config.baselocation !== 'string' || !req.config.baselocation.match(/^http/)) {
        throw Object.assign(new Error('Platform configuration incomplete'), { code: 605 })
      }
      res.json({ 
        uuid: uuid,
        next: {
          always: `${req.config.baselocation}/sign/${uuid}`,
          ...(pushed ? {
            no_push_msg_received: `${req.config.baselocation}/sign/${uuid}/qr`
          } : {})
        },
        refs: {
          qr_png: `${req.config.baselocation}/sign/${uuid}_q.png`,
          qr_matrix: `${req.config.baselocation}/sign/${uuid}_q.json`,
          qr_png_quality_opts: ['m','q','h'],
          websocket_status: `${req.config.baselocation.replace(/^http/, 'ws')}/sign/${uuid}`
        },
        pushed: pushed
      })

      if (pushed) {
        log(`# Pushing payload [ ${uuid} ] to [ ${pushToken.length} ] devices`)

        const d = await resolveAccount(req.db, tx.json.Destination, {
          retryAfter: 3
        })
        
        pushToken.map(r => {
          return {
            payload: {
              uuidv4: uuid
            },
            device: {
              pushtoken: r.device_pushtoken
            },
            application: {
              name: r.application_name
            },
            transaction: {
              type: tx.json.TransactionType || '',
              destination: {
                account: tx.json.Destination || '',
                known: d || {}
              }
            },
            config: {
              fcmkey: req.config.googleFcmKey
            }
          }
        }).forEach(r => {
          const child = fork('src/fork/payloadPushMessage.js')

          child.on('message', msg => {
            if (typeof msg.debug_log !== 'undefined') {
              logChild.apply(null, Object.values(msg.debug_log))
            }
            if (typeof msg.pid !== 'undefined') {
              /**
               * Initial message with PID, child is ready.
               * Deliver data.
               */
              child.send(r)
            }
          })

          child.on('exit', (code, signal) => {
            logChild(`${uuid}: Child process exited with code [ ${code} ]`) // and signal ${signal}
          })
        })
      }
    }
  } catch (e) {
    res.handleError(e)
  }

  tx = null
  return
}
