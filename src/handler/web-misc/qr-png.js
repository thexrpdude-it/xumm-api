const sharp = require('sharp')
const QRCode = require('qrcode')

module.exports = async (req, res, next) => {
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Disposition', 'inline; filename=' + req.params.uuid + '.png')
  
  const qrParams = {
    _m: {
      level: 'M',
      width: 289
    },
    _q: {
      level: 'Q',
      width: 292
    },
    _h: {
      level: 'H',
      width: 318
    }
  }
  const qrimage = await new Promise((resolve, reject) => {
    QRCode.toDataURL(req.config.baselocation + '/sign/' + req.params.uuid, {
      errorCorrectionLevel: qrParams[req.params.level || '_q'].level,
      type: 'png',
      margin: 1,
      width: qrParams[req.params.level || '_q'].width,
      color: {
        light: '#ffffffff',
        dark: '#000000ff'
      }
    }, (err, url) => {
      if (err) {
        reject(err)
      } else {
        resolve(Buffer.from(url.split(',')[1], 'base64'))
      }
    })
  }).catch(r => {
    res.send(Buffer.from(req.config.qrpng, 'base64'))
  })

  if (qrimage) {
    const output = await sharp(qrimage)
      .composite([{input: Buffer.from(req.config.qrpng, 'base64'), gravity: 'centre' }])
      .png()
      .toBuffer()
    
    res.send(Buffer.from(output, 'binary'))
  }
}
