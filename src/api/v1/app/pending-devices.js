/**
 * TODO:
 * PUSH MESSAGE TO OTHER DEVICE UPON UNLOCK (see: `/activate-device`)
 */

module.exports = async (req, res) => {
  try {
    switch (req.method) {
      case 'GET': 
        let pendingExpiry = new Date()
        pendingExpiry.setTime(pendingExpiry.getTime() - 60 * 60 * 1000)
    
        const devices = await req.db(`
          SELECT 
            device_uuidv4_txt as device_uuidv4,
            device_created
          FROM
            devices
          WHERE
            device_lockedbydeviceid = :deviceId
          AND
            device_accesstoken_bin IS NOT NULL
          AND
            device_created > FROM_UNIXTIME(:expiration)
        `, {
          deviceId: req.__auth.device.id, 
          expiration: pendingExpiry / 1000
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
              device_uuidv4_bin = UNHEX(REPLACE(:device_uuidv4,'-',''))
            AND
              device_disabled IS NOT NULL
            AND
              device_accesstoken_bin IS NOT NULL
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
    res.handleError(e)
  }
}
