module.exports = async (expressApp, req, res) => {
  console.log('<< API: PLATFORM OAUTH2 MIDDLEWARE >>')
  return new Promise((resolve, reject) => {
    // Auth middleware allows to overrule (preset, skip next) response 
    // res.json({
    //   test: true
    // })
    // resolve()
    reject(new Error('Nope. Platform API is not yet ready.'))
  })
}
