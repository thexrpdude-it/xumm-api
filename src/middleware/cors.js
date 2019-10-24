module.exports = async function (expressApp) {
  expressApp.use((req, res, next) => {
    const ValidOrigins = expressApp.config.AccessControlAllowOrigins || []
    const ValidOrigin = ValidOrigins.filter(o => {
      return o === (req.get('origin') || '').split('/').slice(0, 3).join('/')
    })[0] || 'http://localhost'
    
    res.header('Access-Control-Allow-Origin', ValidOrigin) // TODO
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    next()
  })
}
