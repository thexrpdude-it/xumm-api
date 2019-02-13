const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  const data = {
    user_uuidv4: uuid(),
    device_uuidv4: uuid(),
    request_ip: req.ip,
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
      user_created = :moment_creation,
      user_created_ip = :request_ip
  `

  const deviceQuery = `
    INSERT IGNORE INTO 
      devices 
    SET 
      user_id = :userId,
      device_uuidv4 = :device_uuidv4,
      device_created = :moment_creation,
      device_created_ip = :request_ip,
      device_disabled = :device_expiration
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
    const user = await req.db(userQuery, data)
    if (user.constructor.name !== 'OkPacket' || typeof user.insertId === 'undefined' || !(user.insertId > 0)) {
      throw new Error(`Operation [user] didn't result in a new record`)
    }
    const device = await req.db(deviceQuery, { 
      ...data, 
      userId: user.insertId, 
      device_expiration: deviceExpiry
    })
    if (device.constructor.name !== 'OkPacket' || typeof device.insertId === 'undefined' || !(device.insertId > 0)) {
      throw new Error(`Operation [device] didn't result in a new record`)
    }

    res.json(response)
  } catch (e) {
    const errorRef = uuid()
    console.log(`ERROR @ ${req.ip} ${errorRef} - ${e.message}`)
    res.status(500).json({
      error: {
        reference: errorRef
      }
    })
  }
}
