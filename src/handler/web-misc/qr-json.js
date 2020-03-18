const QRCode = require('qrcode')

module.exports = async (req, res, next) => {
  res.setHeader('Content-Type', 'application/json')

  const qrcontents = await new Promise((resolve, reject) => {
    QRCode.toString(req.config.baselocation + '/sign/' + req.params.uuid, {
      type: 'utf8',
      errorCorrectionLevel: (req.params.level || '_q').slice(1)
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data.split('\n').filter(r => {
          return !r.match(/^[ ]+$/)
        }).reduce((x, r) => {
          const chars = r.slice(4, -4).split('')
          let a = []
          let b = []
          for (c in chars) {
            a.push(chars[c] === '▀' || chars[c] === '█')
            b.push(chars[c] === '▄' || chars[c] === '█')
          }
          x.push(a)
          x.push(b)
          
          return x
        }, []))
      }
    })
  }).catch(r => {
    res.json({ matrix: [] })
  })

  if (qrcontents) {
    res.json({ matrix: qrcontents })
  }
}
