const getBadgeCount = require('@api/v1/internal/get-user-badge-count')

module.exports = async (req, res) => {
  res.json({ 
    pong: true,
    tosAndPrivacyPolicyVersion: Number(req.config.TosAndPrivacyPolicyVersion) || 0,
    badge: await getBadgeCount({ userId: req.__auth.user.id }, req.db),
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
