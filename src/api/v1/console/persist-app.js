const log = require('debug')('app:devconsole:appcreate')
const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  const mutationTypeTitle = req.params.appId ? 'Update' : 'Create'
  const appId = req.params.appId ? req.params.appId : uuid()
  const appSecret = uuid()


  try {
    if (typeof req.body !== 'object' || req.body === null) {
      throw new Error(mutationTypeTitle + ' app: Invalid application details')
    }
    if (typeof req.body.appName !== 'string' || req.body.appName.trim() === '') {
      throw new Error(mutationTypeTitle + ' app: Application name invalid')
    }
    if (typeof req.body.appDescription !== 'string' || req.body.appDescription.trim() === '') {
      throw new Error(mutationTypeTitle + ' app: Application description invalid')
    }
    if (typeof req.body.appIcon !== 'string' || !req.body.appIcon.trim().match(/^https:\/\/xumm-cdn.imgix.net\//)) {
      throw new Error(mutationTypeTitle + ' app: Application icon URL invalid')
    }

    log(req.__auth)
    const data = {
      application_auth0_owner: req.__auth.jwt.sub,
      application_uuidv4: appId,
      application_secret: appSecret,
      application_name: req.body.appName.trim(),
      application_description: req.body.appDescription.trim(),
      application_webhookurl: (req.body.appWebhookUrl || '').trim(),
      application_icon_url: req.body.appIcon.trim()
    }

    if (req.params.appId) {
      // Update
      const db = await req.db(`
        UPDATE
          applications
        SET
          application_name = :application_name,
          application_description = :application_description,
          application_webhookurl = :application_webhookurl,
          application_icon_url = :application_icon_url
        WHERE
          application_auth0_owner = :application_auth0_owner
        AND
          application_uuidv4 = :application_uuidv4
        AND
          application_disabled = 0
        LIMIT 1
      `, data)

      // log(db)
      if (db.constructor.name !== 'OkPacket' || typeof db.affectedRows === 'undefined' || !(db.affectedRows > 0)) {
        throw Object.assign(new Error('App update error'), { code: 605 })
      }
    } else {
      // Create (insert0)
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

      `, data)

      if (typeof db !== 'object' || typeof db.insertId !== 'number' || db.insertId < 1) {
        throw Object.assign(new Error('App create increment error'), { code: 605 })
      }
    }

    return res.json({
      [req.params.appId ? 'updated' : 'created']: true,
      uuidv4: appId,
      name: req.body.appName.trim(),
      credentials: {
        secret: req.params.appId ? null : appSecret
      }
    })
  } catch (e) {
    e.httpCode = e.code = 404
    return res.handleError(e)
  }
}
