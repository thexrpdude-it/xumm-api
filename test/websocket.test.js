'use strict'

const fetch = require('node-fetch')

process.env.DEBUG = 'app:*'
process.env.HOST = 'localhost'
process.env.PORT = 3001
process.env.NODE_ENV = 'development'

const config = require(__dirname + '/../development.json')

process.env.APIKEY = config.tests.developerApiKeys.APIKEY
process.env.APISECRET = config.tests.developerApiKeys.APISECRET

// TODO:

// Socket
//    Console update
//    Payment page
//    Public websocket

describe('XUMM WebSocket server', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/`

  beforeAll(async () => {
    // Connect socket
  })

  afterAll(async () => {
    // Disconnect socket
  })

})
