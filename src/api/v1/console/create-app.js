const log = require('debug')('app:devconsole:appcreate')
const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  const appId = uuid()
  const appSecret = uuid()

  try {
    if (typeof req.body !== 'object' || req.body === null) {
      throw new Error('Create app: Invalid application details')
    }
    if (typeof req.body.appName !== 'string' || req.body.appName.trim() === '') {
      throw new Error('Create app: Application name invalid')
    }
    if (typeof req.body.appDescription !== 'string' || req.body.appDescription.trim() === '') {
      throw new Error('Create app: Application description invalid')
    }
    if (typeof req.body.appIcon !== 'string' || !req.body.appIcon.trim().match(/^https:\/\/xumm-cdn.imgix.net\//)) {
      throw new Error('Create app: Application icon URL invalid')
    }

    log(req.__auth)

    const db = await req.db(`
      INSERT INTO
        applications
      SET
        application_uuidv4 = :application_uuidv4,
        application_name = :application_name,
        application_secret = :application_secret,
        application_description = :application_description,
        application_webhookurl = :application_webhookurl,
        application_icon_url = :application_icon_url,
        application_auth0_owner = :application_auth0_owner

    `, {
      application_auth0_owner: req.__auth.jwt.sub,
      application_uuidv4: appId,
      application_secret: appSecret,
      application_name: req.body.appName.trim(),
      application_description: req.body.appDescription.trim(),
      application_webhookurl: (req.body.appWebhookUrl || '').trim(),
      application_icon_url: req.body.appIcon.trim()
    })

    if (typeof db !== 'object' || typeof db.insertId !== 'number' || db.insertId < 1) {
      throw Object.assign(new Error('App create increment error'), { code: 605 })
    }

    return res.json({
      created: true,
      uuidv4: appId,
      name: req.body.appName.trim(),
      credentials: {
        secret: appSecret
      }
    })
  } catch (e) {
    e.httpCode = e.code = 404
    return res.handleError(e)
  }
}
