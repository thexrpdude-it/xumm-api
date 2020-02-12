'use strict'

const fetch = require('node-fetch')

process.env.DEBUG = 'app:*'
process.env.HOST = 'localhost'
process.env.PORT = 3001
process.env.NODE_ENV = 'development'

const config = require(__dirname + '/../development.json')

process.env.APIKEY = config.tests.developerApiKeys.APIKEY
process.env.APISECRET = config.tests.developerApiKeys.APISECRET

expect.extend({
  toBeWithinRange (received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      }
    }
  }
})

describe('XUMM iOS/Android APP API', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/api/v1/app/`
  let addedUser
  let activatedDevice

  const {
    signData,
    payloadData,
    lookup,
    iou,
    cancelData
  } = require('./fixtures/data-general')

  const headers = {
    devApi: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.APIKEY,
      'X-API-Secret': process.env.APISECRET
    },
    device () {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    }
  }

  it('should add a user (add-user)', async () => {
    const call = await fetch(`${endpoint}add-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    addedUser = await call.json()

    expect(addedUser).toEqual(expect.objectContaining({
      user: {
        uuid: expect.any(String)
      },
      device: {
        uuid: expect.any(String),
        expire: expect.any(String)
      }
    }))
  })

  it('should activate a new device (activate-device)', async () => {
    const call = await fetch(`${endpoint}activate-device`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${addedUser.user.uuid}.${addedUser.device.uuid}`
      },
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample'
      })
    })
    activatedDevice = await call.json()

    expect(activatedDevice).toEqual(expect.objectContaining({
      activated: true,
      accessToken: expect.any(String),
      locked: false
    }))
  })

  it('should be able to update the push token of an existing device', async () => {
    const call = await fetch(`${endpoint}update-device`, 
    {
      method: 'POST',
      headers: headers.device(),
      body: JSON.stringify({
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample-2'
      })
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      updates: {
        devicePushToken: {
          affected: 1,
          changed: 1
        }
      }
    }))
  })

  it('should add an extra device and activate it', async () => {
    const callAdd = await fetch(`${endpoint}add-device`,
    {
      method: 'POST',
      headers: headers.device(),
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample'
      })
    })
    const addedDevice = await callAdd.json()

    expect(addedDevice).toEqual(expect.objectContaining({
      device: {
        uuid: expect.any(String),
        expire: expect.any(String)
      },
      qr: {
        text: expect.any(String)
      }
    }))

    const callActivate = await fetch(`${endpoint}activate-device`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${addedUser.user.uuid}.${addedDevice.device.uuid}`
      },
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE_ADDED',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE_ADDED-1337.pt-sample'
      })
    })
    const activatedNewDevice = await callActivate.json()

    expect(activatedNewDevice).toEqual(expect.objectContaining({
      activated: true,
      accessToken: expect.any(String),
      locked: true
    }))

    const callPending = await fetch(`${endpoint}pending-devices`, { headers: headers.device() })
    const pendingDevices = await callPending.json()

    expect(pendingDevices).toHaveProperty('devices')
    expect(pendingDevices.devices).toHaveLength(1)
    expect(Object.values(pendingDevices.devices)[0]).toEqual(expect.objectContaining({
      uuidv4: addedDevice.device.uuid,
      created: expect.any(String)
    }))

    const callActivatePending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify({
        uuidv4: addedDevice.device.uuid
      })
    })
    const callActivatePendingBody = await callActivatePending.json()

    expect(callActivatePendingBody).toEqual(expect.objectContaining({
      activated: true
    }))

    const newDevicePings = await fetch(`${endpoint}ping`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedNewDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const newDevicePingsBody = await newDevicePings.json()

    expect(newDevicePingsBody).toEqual(require('./fixtures/pingbody')({addedUser, addedDevice}))
  })

  it('should add an extra device and reject it', async () => {
    const callAdd = await fetch(`${endpoint}add-device`,
    {
      method: 'POST',
      headers: headers.device(),
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample'
      })
    })
    const addedDevice = await callAdd.json()

    expect(addedDevice).toEqual(expect.objectContaining({
      device: {
        uuid: expect.any(String),
        expire: expect.any(String)
      },
      qr: {
        text: expect.any(String)
      }
    }))

    const callActivate = await fetch(`${endpoint}activate-device`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${addedUser.user.uuid}.${addedDevice.device.uuid}`
      },
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE_ADDED_TBR',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE_ADDED_TBR-1337.pt-sample'
      })
    })
    const activatedNewDevice = await callActivate.json()

    expect(activatedNewDevice).toEqual(expect.objectContaining({
      activated: true,
      accessToken: expect.any(String),
      locked: true
    }))

    const callPending = await fetch(`${endpoint}pending-devices`, { headers: headers.device() })
    const pendingDevices = await callPending.json()

    expect(pendingDevices).toHaveProperty('devices')
    expect(pendingDevices.devices).toHaveLength(1)
    expect(Object.values(pendingDevices.devices)[0]).toEqual(expect.objectContaining({
      uuidv4: addedDevice.device.uuid,
      created: expect.any(String)
    }))

    const callActivatePending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'DELETE',
      headers: headers.device(),
      body: JSON.stringify({uuidv4: addedDevice.device.uuid})
    })
    const callActivatePendingBody = await callActivatePending.json()
    expect(callActivatePendingBody).toEqual(expect.objectContaining({ deleted: true }))

    const newDevicePings = await fetch(`${endpoint}ping`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedNewDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const newDevicePingsBody = await newDevicePings.json()

    expect(newDevicePingsBody).toEqual(expect.objectContaining({
      error: {
        code: 831,
        reference: expect.any(String)
      }
    }))
  })

  it('should not contain any pending devices anymore', async () => {
    const callPending = await fetch(`${endpoint}pending-devices`, { headers: headers.device() })
    const callPendingBody = await callPending.json()
    expect(callPendingBody).toEqual(expect.objectContaining({ devices: [] }))
  })

  it('should get account info', async () => {
    const call = await fetch(`${endpoint}account-info/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(require('./fixtures/accountinfo'))
  })

  it('should serve no account info for non existing address', async () => {
    const call = await fetch(`${endpoint}account-info/rXXXXXXXXXXXXXX`, { headers: headers.device() })
    const body = await call.json()
    expect(body).toStrictEqual({})
  })

  it('should error on account info for invalid address', async () => {
    const call = await fetch(`${endpoint}account-info/XXXXXXXXXXXXXX`, { headers: headers.device() })
    const body = await call.json()
    expect(body).toEqual(require('./fixtures/404'))
  })

  it('should get account advisory for blacklisted address', async () => {
    const call = await fetch(`${endpoint}account-advisory/rDPqQfyzSs3p9gW1Qy7zJpMR3gimRM7vbH`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      account: `rDPqQfyzSs3p9gW1Qy7zJpMR3gimRM7vbH`,
      danger: 'CONFIRMED',
      confirmations: expect.any(Object)
    }))
  })

  it('should serve no account advisory for trusted address', async () => {
    const call = await fetch(`${endpoint}account-advisory/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      account: `rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`,
      danger: 'UNKNOWN',
      confirmations: {}
    }))
  })

  it('should error on account advisory for invalid address', async () => {
    const call = await fetch(`${endpoint}account-advisory/XXXXXXXXXXXXXX`, { headers: headers.device() })
    const body = await call.json()
    expect(body).toEqual(require('./fixtures/404'))
  })


  it('should get handles (lookup) for address', async () => {
    const call = await fetch(`${endpoint}handle-lookup/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(lookup.account.header)
    expect(body.matches.length).toBeGreaterThan(0)
    expect(body.matches[0]).toEqual(lookup.account.record)
  })

  it('should get handles (lookup) for slug', async () => {
    const call = await fetch(`${endpoint}handle-lookup/wietse`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(lookup.slug.header)
    expect(body.matches.length).toBeGreaterThan(0)
    expect(body.matches[0]).toEqual(lookup.slug.record)
  })

  it('should get IOUs', async () => {
    const call = await fetch(`${endpoint}curated-ious`, { headers: headers.device() })
    const body = await call.json()

    expect(body).toEqual(iou.header)
    expect(Object.keys(body.details)).toEqual(expect.arrayContaining(['Bitstamp']))
    expect(body.details.Bitstamp).toEqual(iou.bitstamp.header)
    expect(Object.keys(body.details.Bitstamp.currencies)).toEqual(expect.arrayContaining(['USD']))
    expect(body.details.Bitstamp.currencies.USD).toEqual(iou.bitstamp.usd)
  })

  let generatedPayloads = []
  let payloads = []

  it('<Public Developer API> should create three payloads', async () => {
    const generatePayload = async (i) => {
      const generatedPayload = payloadData(i)
      const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.APIKEY,
          'X-API-Secret': process.env.APISECRET
        },
        body: JSON.stringify(generatedPayload)
      })
      generatedPayloads.push(generatedPayload)
      return await call.json()
    }
    for await (let body of [generatePayload(1), generatePayload(2), generatePayload(3)]) {
      payloads.push(body)
    }
  })

  it('should contain valid payloads', async () => {
    expect(payloads[0]).toEqual(expect.objectContaining({
      uuid: expect.any(String),
      next: {
        always: expect.any(String)
      },
      refs: {
        qr_png: expect.any(String),
        qr_matrix: expect.any(String),
        qr_uri_quality_opts: expect.any(Array),
        websocket_status: expect.any(String)
      },
      pushed: expect.any(Boolean)
    }))
  })

  it('should reject a payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[0].uuid}`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify({
        reject: true
      })
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      payload_uuidv4: payloads[0].uuid,
      reference_call_uuidv4: expect.any(String),
      signed: false,
      user_token: expect.any(Boolean),
      return_url: {
        app: expect.any(String),
        web: expect.any(String)
      }
    }))
  })

  it('should sign a payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[1].uuid}`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify(signData)
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      payload_uuidv4: payloads[1].uuid,
      reference_call_uuidv4: expect.any(String),
      signed: true,
      user_token: expect.any(Boolean),
      return_url: {
        app: expect.any(String),
        web: expect.any(String)
      }
    }))
  })

  it('<Public Developer API> should cancel a payload', async () => {
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[2].uuid}`, 
    {
      method: 'DELETE',
      headers: headers.devApi
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      result: {
        cancelled: true,
        reason: 'OK'
      },
      meta: cancelData
    }))
  })

  it('<Public Developer API> should not cancel a payload again', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[2].uuid}`, 
    {
      method: 'DELETE',
      headers: headers.devApi
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      result: {
        cancelled: false,
        reason: 'ALREADY_CANCELLED'
      },
      meta: cancelData
    }))
  })

  it('should not sign a rejected payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[0].uuid}`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify(signData)
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      error: {
        code: 409,
        reference: expect.any(String)
      }
    }))
  })

  it('should not sign a signed payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[1].uuid}`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify(signData)
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      error: {
        code: 409,
        reference: expect.any(String)
      }
    }))
  })

  it('should sign a cancelled payload', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`${endpoint}payload/${payloads[2].uuid}`, 
    {
      method: 'PATCH',
      headers: headers.device(),
      body: JSON.stringify(signData)
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      payload_uuidv4: expect.any(String),
      reference_call_uuidv4: expect.any(String),
      return_url: {
        app: expect.any(String),
        web: expect.any(String)
      },
      signed: true
    }))
  })

  it('<Public Developer API> should be able to fetch a (cancelled but) signed payload', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[2].uuid}`, 
    {
      headers: headers.devApi
    })
    const body = await call.json()

    expect(body).toEqual(require('./fixtures/devapi-signed-payload'))
  })

  it('<Public Developer API> should be able to fetch a pending payload', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[0].uuid}`,
    {
      headers: headers.devApi
    })
    const body = await call.json()

    expect(body).toEqual(require('./fixtures/devapi-pending-payload'))
  })

  it('<Public Developer API> should be able to fetch a (pending) payload by custom identifier', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/ci/${generatedPayloads[0].options.custom_meta.identifier}`,
    {
      headers: headers.devApi
    })
    const body = await call.json()

    expect(body).toEqual(require('./fixtures/devapi-pending-payload'))
  })

  /**
   * End XUMM iOS/Android APP API
   */
})
