const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  try {
    if (Object.keys(req.headers).indexOf('authorization') > -1) {
      const bearer = req.headers.authorization.match(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\.([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/i)
      if (bearer) {
        if (typeof req.body !== 'object' ||
          typeof req.body.uniqueDeviceIdentifier === 'undefined' ||
          typeof req.body.devicePlatform === 'undefined' ||
          typeof req.body.devicePushToken === 'undefined') {
            throw new Error('Missing device information')
        }

        const deviceToActivateQuery = `
          SELECT
            device_id
          FROM 
            devices d
          LEFT JOIN
            users u ON (d.user_id = u.user_id)
          WHERE
            d.device_uuidv4 = :device_uuidv4
          AND
            u.user_uuidv4 = :user_uuidv4
          AND
            d.device_accesstoken IS NULL
          AND
            d.device_disabled > NOW()
        `

        const deviceActivationQuery = `
          UPDATE
            devices
          SET
            device_platform = :platform,
            device_pushtoken = :pushtoken,
            device_extuniqueid = :identifier,
            device_accesstoken = :accesstoken,
            device_disabled = NULL
          WHERE
            device_id = :device_id
          LIMIT 1
        `

        const device = await req.db(deviceToActivateQuery, { 
          user_uuidv4: bearer[1],
          device_uuidv4: bearer[2]
        })

        if (Array.isArray(device) && typeof device[0] === 'object' && Object.keys(device[0]).indexOf('device_id') > -1) {
          const deviceAccessToken = uuid()
          const activatedDevice = await req.db(deviceActivationQuery, { 
            device_id: device[0].device_id,
            platform: req.body.devicePlatform,
            pushtoken: req.body.devicePushToken,
            identifier: req.body.uniqueDeviceIdentifier,
            accesstoken: deviceAccessToken
          })

          if (activatedDevice.changedRows === 1) {
            res.json({
              activated: true,
              accessToken: deviceAccessToken
            })
          } else {
            throw new Error(`Couldn't activate device (invalid state)`)
          }
        } else {
          let e = new Error(`Device cannot be activated (device / user invalid / expired)`)
          Object.assign(e, { code: 900 })
          throw e
        }
      } else {
        throw new Error(`Invalid auth (invalid bearer)`)
      }
    } else {
      throw new Error(`Invalid auth (missing bearer)`)
    }
  } catch (e) {
    const errorRef = uuid()
    console.log(`ERROR @ ${req.ip} ${errorRef} - ${e.message}`)
    res.status(500).json({
      error: {
        reference: errorRef,
        code: e.code || null
      }
    })
  }
}
