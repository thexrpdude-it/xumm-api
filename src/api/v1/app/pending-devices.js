const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  try {
    switch (req.method) {
      case 'GET': 
        let pendingExpiry = new Date()
        pendingExpiry.setTime(pendingExpiry.getTime() - 60 * 60 * 1000)
    
        const devices = await req.db(`
          SELECT 
            device_uuidv4,
            device_created
          FROM
            devices
          WHERE
            device_lockedbydeviceid = :deviceId
          AND
            device_accesstoken IS NOT NULL
          AND
            device_created > :expiration
        `, {
          deviceId: req.__auth.device.id, 
          expiration: pendingExpiry
        })

        res.json({
          devices: devices.map(r => {
            return { 
              uuidv4: r.device_uuidv4,
              created: r.device_created
            }
          })
        })
        break;
      case 'PATCH': 
      case 'DELETE': 
        let update

        if (typeof req.body.uuidv4 === 'string' && req.body.uuidv4.length > 0) {
          update = await req.db(`
            UPDATE
              devices
            SET
              device_lockedbydeviceid = NULL,
              device_disabled = IF(:method = 'PATCH', NULL, NOW())
            WHERE
              device_uuidv4 = :device_uuidv4
            AND
              device_disabled IS NOT NULL
            AND
              device_accesstoken IS NOT NULL
            AND
              device_lockedbydeviceid = :deviceId
            LIMIT 1
          `, { 
            device_uuidv4: req.body.uuidv4,
            deviceId: req.__auth.device.id,
            method: req.method.toUpperCase()
          })
        }
    
        res.json({
          [req.method === 'PATCH' ? 'activated' : 'deleted']: update.affectedRows === 1
        })
        break;
    }
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
