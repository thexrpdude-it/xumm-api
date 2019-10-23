module.exports = async (req, res) => {
  res.json({ 
    pong: true,
    auth: req.__auth
  })
}
