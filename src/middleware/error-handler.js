module.exports = async function (expressApp) {
  expressApp.use ((error, req, res, next) => {
    console.log(' >> ExpressError', error.toString())
    console.log(req.routeType)
    if (req.routeType === 'api') {
      res.status(500).json({ error: true, req: req.url, message: error.toString() })
    } else {
      res.status(500).render('500', { error: error.toString() })
    }
  })
}
