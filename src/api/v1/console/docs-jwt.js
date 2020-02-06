const sign = require('jsonwebtoken').sign
const crypto = require('crypto')

module.exports = async (req, res) => {
  try {
    const app = await req.db(`
      SELECT
        application_name,
        application_secret_txt as application_secret
      FROM 
        applications
      WHERE
        applications.application_auth0_owner = :user
        AND
        application_uuidv4_bin = UNHEX(REPLACE(:appId,'-',''))
        AND
        application_disabled = 0
      LIMIT 1
    `, {
      user: req.__auth.jwt.sub,
      appId: req.params.appId
    })

    if (app.constructor.name === 'Array' && app.length === 1 && app[0].constructor.name === 'RowDataPacket') {      
      const hash = crypto.createHash('md5').update(JSON.stringify({
        visitorIp: (req.headers['x-forwarded-for'] || '').split(',')[0],
        host: req.headers['host'] || '',
        secret: app[0].application_secret
      })).digest('hex').slice(0, 12)

      const authToken = sign({
        name: app[0].application_name,
        email: req.params.appId + '@docs.apps.xumm.dev',
        sec0: req.params.appId,
        sec1: 'Readme.io Sample. Insert your API Secret from apps.xumm.dev here. @' + hash,
        apiKeyScheme: 'api-key',
        version: 1
      }, req.config.readmeIoJwtKey || '', {
        expiresIn: '3m'
      })
    
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
