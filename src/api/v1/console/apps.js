module.exports = async (req, res) => {
  try {
    const applications = await req.db(`
      SELECT
        application_uuidv4_txt as application_uuidv4,
        application_name,
        application_description,
        application_webhookurl,
        application_lastcall,
        application_icon_url
      FROM 
        applications
      WHERE
        applications.application_auth0_owner = :user
      AND
        application_disabled = 0
    `, {
      user: req.__auth.jwt.sub
    })

    if (applications.constructor.name === 'Array' && applications.length > 0 && applications[0].constructor.name === 'RowDataPacket') {
      return res.json({ applications })
    }
    return res.json({ applications: [] })
  } catch (e) {
    e.httpCode = e.code = 404
    return res.handleError(e)
  }
}
