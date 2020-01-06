const sign = require('jsonwebtoken').sign

module.exports = async (req, res) => {
  try {
    const app = await req.db(`
      SELECT
        application_name
      FROM 
        applications
      WHERE
        applications.application_auth0_owner = :user
        AND
        application_uuidv4 = :appId
        AND
        application_disabled = 0
      LIMIT 1
    `, {
      user: req.__auth.jwt.sub,
      appId: req.params.appId
    })

    if (app.constructor.name === 'Array' && app.length === 1 && app[0].constructor.name === 'RowDataPacket') {      
      const authToken = sign({
        name: app[0].application_name,
        email: req.params.appId + '@docs.apps.xumm.dev',
        sec0: req.params.appId,
        sec1: '<<todo: get (generate ReadmeIO specific) from sql>>',
        apiKeyScheme: 'api-key',
        version: 1
      }, req.config.readmeIoJwtKey || '')
    
      return res.json({
        finalUrl: 'https://xumm.readme.io/?auth_token=' + authToken
      })
    } else {
      e.httpCode = e.code = 403
      return res.handleError(e)
    }
  } catch (e) {
    e.httpCode = e.code = 404
    return res.handleError(e)
  }
}
