module.exports = {
  signData: {
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
  },
  payloadData: {
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
  },
  lookup: {
    account: {
      header: expect.objectContaining({
        input: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT',
        live: expect.any(Boolean),
        cached: expect.any(Number),
        explicitTests: expect.any(Object),
        matches: expect.any(Array)
      }),
      record: expect.objectContaining({
        source: expect.any(String),
        alias: expect.any(String),
        account: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT',
        description: expect.any(String)
      })
    },
    slug: {
      header: expect.objectContaining({
        input: 'wietse',
        live: expect.any(Boolean),
        cached: expect.any(Number),
        explicitTests: expect.any(Object),
        matches: expect.any(Array)
      }),
      record: expect.objectContaining({
        source: expect.any(String),
        alias: expect.any(String),
        account: expect.any(String),
        description: expect.any(String)
      })
    }
  },
  iou: {
    header: expect.objectContaining({
      issuers: expect.any(Array),
      currencies: expect.any(Array),
      details: expect.any(Object)
    }),
    bitstamp: {
      header: expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        domain: expect.any(String),
        avatar: expect.any(String),
        currencies: expect.any(Object)
      }),
      usd: expect.objectContaining({
        id: expect.any(Number),
        issuer_id: expect.any(Number),
        name: expect.any(String),
        issuer: expect.any(String),
        currency: expect.any(String),
        avatar: expect.any(String)
      })
    }
  },
  cancelData: {
    exists: true,
    uuid: expect.any(String),
    multisign: expect.any(Boolean),
    submit: expect.any(Boolean),
    destination: expect.any(String),
    resolved_destination: expect.any(String),
    resolved: expect.any(Boolean),
    signed: expect.any(Boolean),
    cancelled: expect.any(Boolean),
    expired: expect.any(Boolean),
    pushed: expect.any(Boolean),
    app_opened: expect.any(Boolean),
    return_url_app: expect.any(String),
    return_url_web: expect.any(String)
  }
}
