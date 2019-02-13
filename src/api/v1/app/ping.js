const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  res.json({ 
    pong: true,
    auth: Object.keys(req.__auth).reduce((a, b) => {
      const s = b.split('_')
      if (typeof a[s[0]] === 'undefined') a[s[0]] = {}
      if (s[1] !== 'id') {
        a[s[0]][s[1]] = req.__auth[b]
      }
      return a
    }, {})
  })
}
