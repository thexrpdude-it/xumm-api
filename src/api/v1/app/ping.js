const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  let badge
  try {
    badge = await req.db(`
      SELECT count(1) as c
      FROM users
      LEFT JOIN tokens ON (tokens.user_id = users.user_id)
      LEFT JOIN payloads ON (payloads.token_id = tokens.token_id)
      WHERE users.user_id = :user_id
        AND tokens.token_hidden = 0
        AND tokens.token_reported = 0
        AND tokens.token_expiration > :now
        AND payloads.payload_handler IS NULL
        AND payloads.payload_expiration > :now
    `, {
      user_id: req.__auth.user.id,
      now: new Date() / 1000
    })
  } catch (e) {
    // Do nothing
  }

  res.json({ 
    pong: true,
    badge: badge.length === 1 ? badge[0].c : 0,
    auth: Object.keys(req.__auth).reduce((a, b) => {
      return Object.assign(a, { 
        [b]: Object.keys(req.__auth[b]).filter(e => {
          return e !== 'id'
        }).reduce((c, d) => {
          return Object.assign(c, {
            [d]: req.__auth[b][d]
          })
        }, {})
      })
    }, {})
  })
}
