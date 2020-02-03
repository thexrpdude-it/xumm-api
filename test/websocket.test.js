'use strict'

const fetch = require('node-fetch')
const WebSocket = require('ws')

process.env.DEBUG = 'app:*'
process.env.HOST = 'localhost'
process.env.PORT = 3001
process.env.NODE_ENV = 'development'

const config = require(__dirname + '/../development.json')

process.env.APIKEY = config.tests.developerApiKeys.APIKEY
process.env.APISECRET = config.tests.developerApiKeys.APISECRET
process.env.ACCESSTOKEN = config.tests.developerApiKeys.ACCESSTOKEN

describe('XUMM WebSocket server', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/`
  let ws
  let payload

  beforeAll(async () => {
    // console.log('Creating a payload...')
    const call = await fetch(`${endpoint}api/v1/platform/payload`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.APIKEY,
        'X-API-Secret': process.env.APISECRET
      },
      body: JSON.stringify({
        options: {
          submit: true,
          multisign: false,
          expire: 2,
          return_url: {
            app: 'https://app.app/?payload={id}',
            web: 'https://web.web/?payload={id}'
          }
        },
        txjson: {	
          TransactionType : 'Payment',
          Destination : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
          Amount: '50000'
        }
      })
    })
    payload = await call.json()
    // console.log(payload)
    // console.log('Connecting websocket...')
    await new Promise((resolve, reject) => {
      ws = new WebSocket(payload.refs.websocket_status.replace(/^http/, 'ws'), {origin: payload.next.always})
      
      ws.on('open', () => {
        // console.log('Websocket connected')
        resolve()
      })

      ws.on('message', m => {
        // console.log('WS Message', m)
      })
    })
    return
  })

  afterAll(async () => {
    // console.log('Closing websocket...')
    return await new Promise((resolve, reject) => {
      ws.on('close', () => {
        resolve()
      })
      ws.close()
    })
  })


  it('should receive a Welcome message', async () => {
    const welcomeMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No message (Welcome...) message received'))
      }, 2000)
      ws.on('message', m => {
        try {
          const message = JSON.parse(m)
          if (typeof message.message === 'string') {
            clearTimeout(timeout)
            resolve(message)
          }
        } catch (e) {
          clearTimeout(timeout)
          reject (e)
        }
      })
    })
    expect(welcomeMessage).toEqual(expect.objectContaining({
      message: `Welcome ${payload.uuid}`
    }))
  })

  it('should receive an expire message', async () => {
    const welcomeMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No expires_in_seconds message received'))
      }, 2000)
      ws.on('message', m => {
        try {
          const message = JSON.parse(m)
          if (typeof message.expires_in_seconds === 'number') {
            clearTimeout(timeout)
            resolve(message)
          }
        } catch (e) {
          clearTimeout(timeout)
          reject (e)
        }
      })
    })
    expect(welcomeMessage).toEqual(expect.objectContaining({
      expires_in_seconds: expect.any(Number)
    }))
  })

  it('should receive an `opened` message', async () => {
    const welcomeMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No opened message received'))
      }, 2000)

      fetch(`${endpoint}api/v1/app/payload/${payload.uuid}`, 
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ACCESSTOKEN}`
        }
      })

      ws.on('message', m => {
        try {
          const message = JSON.parse(m)
          clearTimeout(timeout)
          resolve(message)
        } catch (e) {
          clearTimeout(timeout)
          reject (e)
        }
      })
    })
    expect(welcomeMessage).toEqual(expect.objectContaining({
      opened: true
    }))
  })

  it('should receive a `resolved` message', async () => {
    const welcomeMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No resolved message received'))
      }, 2000)

      fetch(`${endpoint}api/v1/app/payload/${payload.uuid}`, 
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ACCESSTOKEN}`
        },
        body: JSON.stringify({
          reject: true
        })  
      })

      ws.on('message', m => {
        try {
          const message = JSON.parse(m)
          clearTimeout(timeout)
          resolve(message)
        } catch (e) {
          clearTimeout(timeout)
          reject (e)
        }
      })
    })
    expect(welcomeMessage).toEqual(expect.objectContaining({
      payload_uuidv4: payload.uuid, 
      reference_call_uuidv4: expect.any(String),
      return_url: {
        app: expect.any(String),
        web: expect.any(String)
      },
      signed: false,
      user_token: expect.any(Boolean)
    }))
  })

})
