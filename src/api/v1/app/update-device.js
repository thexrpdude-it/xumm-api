const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  try {
    let updates = {}

    if (typeof req.body.devicePushToken === 'string' && req.body.devicePushToken.length > 0) {
      updates.devicePushToken = await req.db(`
        UPDATE
          devices
        SET
          device_pushtoken = :device_pushtoken
        WHERE
          device_uuidv4_bin = UNHEX(REPLACE(:device_uuidv4,'-',''))
        AND
          (device_disabled IS NULL OR device_disabled > NOW())
        AND
          device_accesstoken_bin IS NOT NULL
        LIMIT 1
      `, { 
        device_pushtoken: req.body.devicePushToken,
        device_uuidv4: req.__auth.device.uuidv4
      })
    }

    res.json({
      updates: Object.keys(updates).reduce((a, b) => {
        return Object.assign(a, { 
          [b]: { 
            affected: updates[b].affectedRows,
            changed: updates[b].changedRows
          } 
        })
      }, {})
    })
  } catch (e) {
    res.handleError(e)
  }
}
