module.exports = async (expressApp, req, res) => {
  console.log('<< API: APP AUTH (CUSTOM, TOKEN, HEADERS) MIDDLEWARE >>')
  return new Promise((resolve, reject) => {
    // resolve(null)
    reject(new Error('Nope. APP API is not yet ready.'))
  })
}
