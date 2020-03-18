module.exports = expect.objectContaining({
  code: 404,
  error: true,
  message: expect.any(String),
  reference: expect.any(String),
  req: expect.any(String)
})
