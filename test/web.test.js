/**
 * @jest-environment jsdom
 */
const fetch = require('node-fetch')
const jsdom = require('jsdom').JSDOM

process.env.DEBUG = 'app:*'
process.env.HOST = 'localhost'
process.env.PORT = 3001
process.env.NODE_ENV = 'development'

const config = require(__dirname + '/../development.json')

process.env.APIKEY = config.tests.developerApiKeys.APIKEY
process.env.APISECRET = config.tests.developerApiKeys.APISECRET

describe('XUMM Website & Payload page', () => {
  const endpoint = `http://${process.env.HOST}:${process.env.PORT}/`

  it('should render the homepage & find the slogan', async () => {
    const call = await fetch(endpoint)
    const html = await call.text()
    htmlNode = new jsdom(html)

    const document = htmlNode.window.document
    const intro = document.querySelector('section[name="intro"] h1').innerHTML

    expect(intro).toEqual(expect.stringMatching('Signed, Sent, Delivered'))
  })

  it('should render the 404 page', async () => {
    const call = await fetch(endpoint + 'page-doesnt-exist')
    const html = await call.text()
    htmlNode = new jsdom(html)

    const document = htmlNode.window.document
    const header = document.querySelector('.card-header.bg-secondary.text-white').textContent.trim()

    expect(header).toEqual(expect.stringMatching(/Error \(404\)/))
  })

  it('should render a payload page with QR', async () => {
    const payloadCall = await fetch(`${endpoint}api/v1/platform/payload`, 
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.APIKEY,
        'X-API-Secret': process.env.APISECRET
      },
      body: JSON.stringify({
        txjson: {	
          TransactionType : 'Payment',
          Destination : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
          Amount: '50000'
        }
      })
    })
    payload = await payloadCall.json()

    const call = await fetch(payload.next.always)
    const html = await call.text()
    htmlNode = new jsdom(html)

    const document = htmlNode.window.document
    const header = document.querySelector('.card-header.bg-dark.text-white').textContent.trim()
    const qr = document.querySelectorAll('svg[viewBox="0 0 256 256"]')

    expect(header).toEqual(expect.stringMatching('Sign request'))
    expect(qr).toHaveLength(3)
  })

  it('should render the TOS page', async () => {
    const call = await fetch(endpoint + 'app/webviews/tos-privacy/en_GB')
    const html = await call.text()
    htmlNode = new jsdom(html)

    const document = htmlNode.window.document
    const lastPre = document.querySelector('pre:last-child').innerHTML

    expect(lastPre).toEqual(expect.stringMatching('en_GB'))
  })

  it('should render the credits page', async () => {
    const call = await fetch(endpoint + 'app/webviews/credits/en_GB')
    const html = await call.text()
    htmlNode = new jsdom(html)

    const document = htmlNode.window.document
    const lastPre = document.querySelector('pre:last-child').innerHTML

    expect(lastPre).toEqual(expect.stringMatching('en_GB'))
  })
})
