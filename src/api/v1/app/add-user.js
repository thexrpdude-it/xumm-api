const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  const data = {
    user_uuidv4: uuid(),
    device_uuidv4: uuid(),
    request_ip: req.remoteAddress || req.ip,
    moment_creation: new Date()
  }

  let deviceExpiry = new Date()
  deviceExpiry.setTime(data.moment_creation.getTime() + 60 * 60 * 1000)
  
  const userQuery = `
    INSERT IGNORE INTO 
      users 
    SET 
      user_uuidv4 = :user_uuidv4, 
      user_slug = '',
      user_name = '',
      user_profilepage = 0, 
      user_created = FROM_UNIXTIME(:moment_creation),
      user_created_ip = :request_ip
  `

  const deviceQuery = `
    INSERT IGNORE INTO 
      devices 
    SET 
      user_id = :userId,
      device_uuidv4 = :device_uuidv4,
      device_created = FROM_UNIXTIME(:moment_creation),
      device_created_ip = :request_ip,
      device_disabled = FROM_UNIXTIME(:device_expiration)
  `

  let response = {
    user: {
      uuid: data.user_uuidv4
    },
    device: {
      uuid: data.device_uuidv4,
      expire: deviceExpiry
    }
  }

  try {
    const user = await req.db(userQuery, {
      ...data,
      moment_creation: data.moment_creation / 1000
    })
    if (user.constructor.name !== 'OkPacket' || typeof user.insertId === 'undefined' || !(user.insertId > 0)) {
      throw new Error(`Operation [user] didn't result in a new record`)
    }
    const device = await req.db(deviceQuery, { 
      ...data, 
      userId: user.insertId,
      moment_creation: data.moment_creation / 1000,
      device_expiration: deviceExpiry / 1000
    })
    if (device.constructor.name !== 'OkPacket' || typeof device.insertId === 'undefined' || !(device.insertId > 0)) {
      throw new Error(`Operation [device] didn't result in a new record`)
    }

    res.json(response)
  } catch (e) {
    res.handleError(e)
  }
}
