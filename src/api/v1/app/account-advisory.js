module.exports = async (req, res) => {
  res.json({
    dev: true,
    params: req.params
  })
}
