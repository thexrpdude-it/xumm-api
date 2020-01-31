'use strict'

const fetch = require('node-fetch')

process.env.DEBUG = 'app:*'
process.env.HOST = 'localhost'
process.env.PORT = 3001
process.env.NODE_ENV = 'development'

const config = require(__dirname + '/../development.json')

process.env.APIKEY = config.tests.developerApiKeys.APIKEY
process.env.APISECRET = config.tests.developerApiKeys.APISECRET

describe('XUMM iOS/Android APP API', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/api/v1/app/`
  let addedUser
  let activatedDevice
  let expectedCancelMeta

  it('should add a user (add-user)', async () => {
    const call = await fetch(`${endpoint}add-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    addedUser = await call.json()
    // console.log({addedUser})

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
    // console.log({activatedDevice})

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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample'
      })
    })
    const addedDevice = await callAdd.json()
    // console.log({addedDevice})

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
    // console.log({activatedNewDevice})

    expect(activatedNewDevice).toEqual(expect.objectContaining({
      activated: true,
      accessToken: expect.any(String),
      locked: true
    }))

    const callPending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const pendingDevices = await callPending.json()
    // console.log({pendingDevices})

    expect(pendingDevices).toHaveProperty('devices')
    expect(pendingDevices.devices).toHaveLength(1)
    expect(Object.values(pendingDevices.devices)[0]).toEqual(expect.objectContaining({
      uuidv4: addedDevice.device.uuid,
      created: expect.any(String)
    }))

    const callActivatePending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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

    expect(newDevicePingsBody).toEqual(expect.objectContaining({
      pong: true,
      tosAndPrivacyPolicyVersion: expect.any(Number),
      badge: expect.any(Number),
      auth: {
        user: {
          uuidv4: addedUser.user.uuid,
          slug: expect.any(String),
          name: expect.any(String)
        },
        device: {
          uuidv4: addedDevice.device.uuid,
          idempotence: expect.any(Number)
        },
        call: {
          hash: expect.any(String),
          idempotence: expect.any(Number),
          uuidv4: expect.any(String)
        }
      }
    }))
  })

  it('should add an extra device and reject it', async () => {
    const callAdd = await fetch(`${endpoint}add-device`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
      body: JSON.stringify({
        uniqueDeviceIdentifier: 'XUMMJESTTESTSUITE',
        devicePlatform: 'ios',
        devicePushToken: 'XUMMJESTTESTSUITE-1337.pt-sample'
      })
    })
    const addedDevice = await callAdd.json()
    // console.log({addedDevice})

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
    // console.log({activatedNewDevice})

    expect(activatedNewDevice).toEqual(expect.objectContaining({
      activated: true,
      accessToken: expect.any(String),
      locked: true
    }))

    const callPending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const pendingDevices = await callPending.json()
    // console.log({pendingDevices})

    expect(pendingDevices).toHaveProperty('devices')
    expect(pendingDevices.devices).toHaveLength(1)
    expect(Object.values(pendingDevices.devices)[0]).toEqual(expect.objectContaining({
      uuidv4: addedDevice.device.uuid,
      created: expect.any(String)
    }))

    const callActivatePending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
      body: JSON.stringify({
        uuidv4: addedDevice.device.uuid
      })
    })
    const callActivatePendingBody = await callActivatePending.json()

    expect(callActivatePendingBody).toEqual(expect.objectContaining({
      deleted: true
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

    expect(newDevicePingsBody).toEqual(expect.objectContaining({
      error: {
        code: 831,
        reference: expect.any(String)
      }
    }))
  })

  it('should not contain any pending devices anymore', async () => {
    const callPending = await fetch(`${endpoint}pending-devices`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const callPendingBody = await callPending.json()

    expect(callPendingBody).toEqual(expect.objectContaining({
      devices: []
    }))
  })

  it('should get account info', async () => {
    const call = await fetch(`${endpoint}account-info/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      account: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT',
      name: expect.any(String),
      domain: expect.any(String),
      blocked: false,
      source: expect.any(String)
    }))
  })

  it('should serve no account info for non existing address', async () => {
    const call = await fetch(`${endpoint}account-info/rXXXXXXXXXXXXXX`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toStrictEqual({})
  })

  it('should error on account info for invalid address', async () => {
    const call = await fetch(`${endpoint}account-info/XXXXXXXXXXXXXX`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      code: 404,
      error: true,
      message: expect.any(String),
      method: 'GET',
      reference: expect.any(String),
      req: '/v1/app/account-info/XXXXXXXXXXXXXX'
    }))
  })

  it('should get account advisory for blacklisted address', async () => {
    const call = await fetch(`${endpoint}account-advisory/rDPqQfyzSs3p9gW1Qy7zJpMR3gimRM7vbH`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      account: `rDPqQfyzSs3p9gW1Qy7zJpMR3gimRM7vbH`,
      danger: 'CONFIRMED',
      confirmations: expect.any(Object)
    }))
  })

  it('should serve no account advisory for trusted address', async () => {
    const call = await fetch(`${endpoint}account-advisory/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      account: `rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`,
      danger: 'UNKNOWN',
      confirmations: {}
    }))
  })

  it('should error on account advisory for invalid address', async () => {
    const call = await fetch(`${endpoint}account-advisory/XXXXXXXXXXXXXX`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      code: 404,
      error: true,
      message: expect.any(String),
      method: 'GET',
      reference: expect.any(String),
      req: '/v1/app/account-advisory/XXXXXXXXXXXXXX'
    }))
  })


  it('should get handles (lookup) for address', async () => {
    const call = await fetch(`${endpoint}handle-lookup/rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      input: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT',
      live: expect.any(Boolean),
      cached: expect.any(Number),
      explicitTests: expect.any(Object),
      matches: expect.any(Array)
    }))
    expect(body.matches.length).toBeGreaterThan(0)
    expect(body.matches[0]).toEqual(expect.objectContaining({
      source: expect.any(String),
      alias: expect.any(String),
      account: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT',
      description: expect.any(String)
    }))
  })

  it('should get handles (lookup) for slug', async () => {
    const call = await fetch(`${endpoint}handle-lookup/wietse`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      input: 'wietse',
      live: expect.any(Boolean),
      cached: expect.any(Number),
      explicitTests: expect.any(Object),
      matches: expect.any(Array)
    }))
    expect(body.matches.length).toBeGreaterThan(0)
    expect(body.matches[0]).toEqual(expect.objectContaining({
      source: expect.any(String),
      alias: expect.any(String),
      account: expect.any(String),
      description: expect.any(String)
    }))
  })

  it('should get IOUs', async () => {
    const call = await fetch(`${endpoint}curated-ious`, 
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      issuers: expect.any(Array),
      currencies: expect.any(Array),
      details: expect.any(Object)
    }))
    expect(Object.keys(body.details)).toEqual(expect.arrayContaining(['Bitstamp']))
    expect(body.details.Bitstamp).toEqual(expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      domain: expect.any(String),
      avatar: expect.any(String),
      currencies: expect.any(Object)
    }))
    expect(Object.keys(body.details.Bitstamp.currencies)).toEqual(expect.arrayContaining(['USD']))
    expect(body.details.Bitstamp.currencies.USD).toEqual(expect.objectContaining({
      id: expect.any(Number),
      issuer_id: expect.any(Number),
      name: expect.any(String),
      issuer: expect.any(String),
      currency: expect.any(String),
      avatar: expect.any(String)
    }))
  })

  let payloads = []

  it('<Public Developer API> should create three payloads', async () => {
    const generatePayload = async () => {
      const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload`, 
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
            expire: 100,
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
      return await call.json()
    }
    for await (let body of [generatePayload(), generatePayload(), generatePayload()]) {
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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

  const signData = {
    signed_blob: '1200032280000000240000003241833237B8665D2F4E00135E8DE646589F68400000000000000C732103709723A5967EAAED571B71DB511D87FA44CC7CDDF827A37F457A25E14D862BCD74473045022100C6A6999BD33153C6A236D78438D1BFEEEC810CFE05D0E41339B577560C9143CA022074F07881F559F56593FF680049C12FC3BCBB0B73CE02338651522891D95886F981146078086881F39B191D63B528D914FEA7F8CA2293F9EA7C06636C69656E747D15426974686F6D7020746F6F6C20762E20302E302E337E0A706C61696E2F74657874E1F1',
    tx_id: '9B124C14528ED14C0BDA17075A39B90ABED598B77A22DFEEBD913CAC07A513BC',
    dispatched: {
      to: 'wss://xrpl.ws',
      result: 'tes_SUCCESS',
      nodetype: 'CUSTOM'
    },
    permission: {
      push: true,
      days: 30
    }
  }

  it('should sign a payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[1].uuid}`, 
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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
    expectedCancelMeta = {
      exists: true,
      uuid: payloads[2].uuid,
      multisign: expect.any(Boolean),
      submit: expect.any(Boolean),
      destination: expect.any(String),
      resolved_destination: expect.any(String),
      finished: expect.any(Boolean),
      expired: expect.any(Boolean),
      pushed: expect.any(Boolean),
      app_opened: expect.any(Boolean),
      return_url_app: expect.any(String),
      return_url_web: expect.any(String)
    }

    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[2].uuid}`, 
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.APIKEY,
        'X-API-Secret': process.env.APISECRET
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      result: {
        cancelled: true,
        reason: 'OK'
      },
      meta: expectedCancelMeta
    }))
  })

  it('<Public Developer API> should not cancel a payload again', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`http://${process.env.HOST}:${process.env.PORT}/api/v1/platform/payload/${payloads[2].uuid}`, 
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.APIKEY,
        'X-API-Secret': process.env.APISECRET
      }
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      result: {
        cancelled: false,
        reason: 'ALREADY_EXPIRED'
      },
      meta: expectedCancelMeta
    }))
  })

  it('should not sign a rejected payload', async () => {
    const call = await fetch(`${endpoint}payload/${payloads[0].uuid}`, 
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
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

  it('should not sign a cancelled payload', async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500)
    })
    const call = await fetch(`${endpoint}payload/${payloads[2].uuid}`, 
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activatedDevice.accessToken}.0.${'0'.repeat(64)}`
      },
      body: JSON.stringify(signData)
    })
    const body = await call.json()

    expect(body).toEqual(expect.objectContaining({
      error: {
        code: 510,
        reference: expect.any(String)
      }
    }))
  })

  /**
   * End XUMM iOS/Android APP API
   */
})
