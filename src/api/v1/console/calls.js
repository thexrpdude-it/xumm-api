const log = require('debug')('app:console')

module.exports = async (req, res) => {
  try {
    const data = await req.db(`
      SELECT
        calls.*,
        UNIX_TIMESTAMP(calls.call_moment) as call_moment_ts,
        payloads.call_uuidv4 as payload_uuidv4,
        tokens.token_issued,
        tokens.token_expiration,
        tokens.token_accesstoken,
        tokens.token_days_valid,
        tokens.token_hidden
      FROM
        applications
      LEFT JOIN
        calls ON (
          calls.application_id = applications.application_id
        )
      LEFT JOIN
        payloads ON (
          payloads.call_uuidv4 = calls.call_uuidv4
        )
      LEFT JOIN
        tokens ON (
          tokens.call_uuidv4 = calls.call_uuidv4
        )
      WHERE
        application_uuidv4 = :app
      AND
        application_auth0_owner = :user
      AND
        application_disabled = 0
      AND
      	calls.call_type = 'platform'
      ORDER BY
        FIELD(calls.call_uuidv4, :record) DESC,
        calls.call_id DESC
      LIMIT :skip, :take
    `, {
      user: req.__auth.jwt.sub || '',
      app: req.params.appId || '',
      record: req.params.selectedRecord || '',
      skip: 0,
      take: 50
    })

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
