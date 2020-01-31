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
// Public website:
// *    - Payload Page
// *    - TOS

describe('XUMM Website & Payload page', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/`
})
