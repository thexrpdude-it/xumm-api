const fetch = require('node-fetch')
const options = {
  module_name: 'payloadPushMessage',
  process_timeout: 5
}

const log = function () {
  process.send({ debug_log: arguments })
}

// TODO: Localize i18n

/**
 * Code
 */

const main = async (data) => {
  let timeout
  timeout = setTimeout(() => {
    log(`TIMEOUT @ ${options.module_name} [ payload(${data.payload.uuidv4}) ]`)
    process.exit(1)
  }, options.process_timeout * 1000)

  try {
    log('PUSHDATA', data.transaction)
    // TODO: Actual Push Delivery
    const url = 'https://fcm.googleapis.com/fcm/send'
    const response = await fetch(url, {
      method: 'post',
      body: JSON.stringify({
        to: data.device.pushtoken,
        notification: {
          title: `${data.application.name}`,
          // subtitle: ,
          body: `${data.transaction.type} transaction to ${data.transaction.destination.known.knownaccount_name || data.transaction.destination.account}`,
          // sound: 'default',
          click_action: 'SIGNTX'
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + data.config.fcmkey
      }
    })

    const responseText = await response.text()
    log(`Webhook [ ${options.module_name} ] response text:`, responseText.slice(0, 500))
  } catch(e) {
    log(`${e.message} @ ${options.module_name} [ payload(${data.payload.uuidv4}) ]`)
    process.exit(1)
  }

  clearTimeout(timeout)
  process.exit(0)
}

/**
 * INIT
 */

process.send({ module: options.module_name, pid: process.pid })

process.on('message', msg => {
  if (typeof msg.payload !== 'undefined' && msg.payload.uuidv4 !== 'undefined') {
    main(msg)
  } else {
    // log(`<< ${options.module_name} >> Message from parent: `, msg)
    log(`<< ${options.module_name} >> Exit, invalid message from parent: `, msg)
    process.exit(1)
  }
})
