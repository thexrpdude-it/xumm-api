// const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  res.json({ 
    pong: true,
    auth: Object.keys(req.__auth).reduce((a, b) => {
      return Object.assign(a, { 
        [b]: Object.keys(req.__auth[b]).filter(e => {
          return e !== 'id' && e !== 'secret'
        }).reduce((c, d) => {
          return Object.assign(c, {
            [d]: req.__auth[b][d]
          })
        }, {})
      })
    }, {
      quota: {}
    })
  })
}
