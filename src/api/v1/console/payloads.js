const log = require('debug')('app:jwt-tokens')

module.exports = async (req, res) => {
  try {
    const data = await req.db(`
      SELECT
        payloads.*,
        tokens.token_issued,
        tokens.token_expiration,
        tokens.token_accesstoken,
        tokens.token_days_valid
      FROM
        applications
      LEFT JOIN
        payloads ON (
          payloads.application_id = applications.application_id
        )
      LEFT JOIN
        tokens ON (
          tokens.call_uuidv4 = payloads.call_uuidv4
        )
      WHERE
        application_uuidv4 = :app
      AND
        application_auth0_owner = :user
      AND
        application_disabled = 0
      AND
        payloads.call_uuidv4 IS NOT NULL
      ORDER BY
        FIELD(payloads.call_uuidv4, :record) DESC,
        payloads.payload_id DESC
      LIMIT :skip, :take
    `, {
      user: req.__auth.jwt.sub || '',
      app: req.params.appId || '',
      record: req.params.selectedRecord || '',
      skip: 0,
      take: 50
    })

    // await new Promise((resolve, reject) => {
    //   setTimeout(() => {
    //     resolve()
    //   }, 4000)
    // })

    if (data.constructor.name === 'Array' && data.length > 0 && data[0].constructor.name === 'RowDataPacket') {
      return res.json(data.map(r => {
        const record = Object.assign({}, r)
        Object.keys(record).forEach(k => {
          if ((new RegExp('_id$')).test(k) || ['call_emessage_debug'].indexOf(k) > -1) {
            Object.assign(record, { [k]: undefined })
          }
        })
        return record
      }))
    }
    return res.json({ data: false })
} catch (e) {
    e.httpCode = e.code = 404
    return res.handleError(e)
  }
}
