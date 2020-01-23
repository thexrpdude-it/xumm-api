const fetch = require('node-fetch')
const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  const data = {
    device_uuidv4: uuid(),
    request_ip: req.remoteAddress || req.ip,
    moment_creation: new Date()
  }

  let deviceExpiry = new Date()
  deviceExpiry.setTime(data.moment_creation.getTime() + 60 * 60 * 1000)

  try {
    const createDeviceQuery = `
      INSERT IGNORE INTO 
        devices 
      SET 
        user_id = :userId,
        device_lockedbydeviceid = :deviceId,
        device_uuidv4 = :device_uuidv4,
        device_created = FROM_UNIXTIME(:moment_creation),
        device_created_ip = :request_ip,
        device_disabled = FROM_UNIXTIME(:device_expiration)
    `
    const device = await req.db(createDeviceQuery, {
      ...data,
      userId: req.__auth.user.id,
      deviceId: req.__auth.device.id,
      moment_creation: data.moment_creation / 1000,
      device_expiration: deviceExpiry / 1000
    })
    if (device.constructor.name !== 'OkPacket' || typeof device.insertId === 'undefined' || !(device.insertId > 0)) {
      throw new Error(`Operation [device] didn't result in a new record`)
    }

    res.json({
      device: {
        uuid: data.device_uuidv4,
        expire: deviceExpiry
      },
      qr: {
        text: `https://xrpl-labs.com/pair/${req.__auth.user.uuidv4}.${data.device_uuidv4}`
      }
    })
  } catch (e) {
    res.handleError(e)
  }
}
