const fetch = require('node-fetch')
const log = require('debug')('app:handle-resolve')
const knownAccount = require('@api/v1/internal/known-account-hydrate')

const cacheSeconds = 60 * 15 // 15 minutes
// const cacheSeconds = 1

/**
 * Todo: add XUMM hashed address book function lookup
 */

const is = {
  validEmailAccount (query) {
    const tester = /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

    if (!query) {
      return false
    }

    if (query.length > 254) {
      return false
    }
    
    const valid = tester.test(query)

    if (!valid) {
      return false
    }

    const parts = query.split('@')
    if (parts[0].length > 64) {
      return false
    }
    
    const domainParts = parts[1].split('.')
    if (domainParts.some(part => part.length > 63 )) {
      return false
    }

    return true
  },
  possibleXrplAccount (query) {
    return new RegExp(/^r[0-9a-zA-Z]{3,}$/).test(query)
  }
}

const xrplns = {
  networks: [],
  initialized: false,
  async call (url) {
    const callApi = await fetch('https://api.xrplns.com/v1/' + url, {
      headers: {
        'XRPLNS-KEY': app.config.xrplnsKey || ''
      },
      method: 'get',
      timeout: 3000
    })
    const json = await callApi.json()
    return json
  },
  async initialize () {
    log('Initializing XRPLNS, fetching social networks')
    this.networks = await this.call('social-networks')
    log('Initialized XRPLNS social networks', this.networks)
  },
  sanitizeQuery (query, network) {
    if (network === 'local' || network === 'twitter') {
      return query.replace(/^@/, '')
    }
    return query
  },
  async get (query) {
    const source = 'xrplns'
    try {
      const results = await (async () => {
        if (is.validEmailAccount(query)) {
          const callResults = await this.call('resolve/social/email/' + query)
          return [Object.assign(callResults || {}, { network: 'email' })]
        } else {
          return Promise.all(this.networks.map(async n => {
            const callResults = await this.call('resolve/social/' + n + '/' + this.sanitizeQuery(query, n))
            return Object.assign(callResults || {}, { network: n })
          }).concat(await (async () => {
            const callResults = await this.call('resolve/user/' + this.sanitizeQuery(query, 'local'))
            if (callResults !== null &&
              typeof callResults === 'object' &&
              typeof callResults.data === 'object' &&
              callResults.data !== null &&
              typeof callResults.data.xrplAccounts === 'object'
            ) {
              const data = callResults.data.xrplAccounts
              return data.map(d => {
                return {
                  network: 'local',
                  data: d
                }
              })
            }
          })()))
        }
      })()

      // log(results)

      return results.filter(r => r !== null && typeof r === 'object' && typeof r.data === 'object' && typeof r.data.xrplAccount === 'string').map(r => {
        return {
          source,
          network: r.network,
          alias: r.data.slug || query,
          account: r.data.xrplAccount,
          tag: r.data.destinationTag === '' ? null : Number(r.data.destinationTag),
          description: r.data.label || ''
        }
      })
    } catch (e) {
      log('Query @' + source + ' for [' + query + ']', e.message)
    }
    return []
  }
}

const bithomp = {
  async get (query) {
    const source = 'bithomp.com'
    try {
      const call = await fetch('https://bithomp.com/api/v1/user/' + query, {
        method: 'get',
        timeout: 2000
      })
      const response = await call.json()
      if (typeof response === 'object' && response !== null && typeof response.address === 'string') {
        return [{
          source,
          network: null,
          alias: response.username || query,
          account: response.address,
          tag: null,
          description: ''
        }]
      }
    } catch (e) {
      log('Query @' + source + ' for [' + query + ']', e.message)
    }
    return []
  }
}

const xrpscan = {
  async get (query) {
    const source = 'xrpscan.com'
    if (is.possibleXrplAccount(query)) {
      try {
        const call = await fetch('https://api.xrpscan.com/api/v1/account/' + query, {
          method: 'get',
          timeout: 2000
        })
        const response = await call.json()
        if (typeof response === 'object' && response !== null && typeof response.account === 'string' && typeof response.accountName === 'object' && response.accountName !== null) {
          return [{
            source,
            network: null,
            alias: response.accountName.name || query,
            account: response.account,
            tag: null,
            description: response.accountName.desc || ''
          }]
        }
      } catch (e) {
        log('Query @' + source + ' for [' + query + ']', e.message)
      }
    }
    return []
  }
}

const xrpl = {
  async get (query) {
    const source = 'xrpl'
    if (is.possibleXrplAccount(query)) {
      try {
        const call = await fetch('https://s1.ripple.com:51234', {
          method: 'post',
          timeout: 2000,
          body: JSON.stringify({
            method: 'account_info',
            params: [ { account: query } ]
          }),
        })
        const response = await call.json()
        if (typeof response === 'object' && response !== null && typeof response.result === 'object' && response.result !== null && typeof response.result.account_data === 'object') {
          return [{
            source,
            network: null,
            alias: typeof response.result.account_data.Domain === 'string' && response.result.account_data.Domain !== '' ? Buffer.from(response.result.account_data.Domain, 'hex').toString('utf-8') : query,
            account: response.result.account_data.Account,
            tag: null,
            description: ''
          }]
        }
      } catch (e) {
        log('Query @' + source + ' for [' + query + ']', e.message)
      }
    }
    return []
  }
}

const ripple = {
  async get (query) {
    const source = 'id.ripple.com'
    try {
      const call = await fetch('https://id.ripple.com/v1/user/' + query, {
        method: 'get',
        timeout: 2000
      })
      const response = await call.json()
      if (typeof response === 'object' && response !== null && typeof response.address === 'string') {
        return [{
          source,
          network: null,
          alias: response.username || query,
          account: response.address,
          tag: null,
          description: ''
        }]
      }
    } catch (e) {
      log('Query @' + source + ' for [' + query + ']', e.message)
    }
    return []
  }
}

const internalAccounts = {
  async get (query) {
    const source = 'xumm.app'
    if (is.possibleXrplAccount(query)) {
      try {
        const existing = await app.db(`
          SELECT 
            knownaccount_name,
            knownaccount_account
          FROM
            knownaccounts
          WHERE
            knownaccount_account LIKE CONCAT(:knownaccount_account, '%')
          AND
            knownaccount_currency = ''
          LIMIT 10
        `, {
          knownaccount_account: query
        })

        if (existing.length > 0) {
          return existing.map(a => {
            return {
              source,
              network: null,
              alias: a.knownaccount_name,
              account: a.knownaccount_account,
              tag: null,
              description: ''
            }
          })
        }
      } catch (e) {
        log('Query @' + source + ' for [' + query + ']', e.message)
      }
    }

    return []
  }
}

const activeApps = [ bithomp, ripple, xrpscan, internalAccounts, xrplns, xrpl ]

const app = {
  config: {},
  db: null,
  initializing: false,
  initialized: false,
  async initialize (config, db) {
    this.config = config
    this.db = db

    if (!this.initializing) {
      this.initializing = true
      const reducedApps = activeApps.reduce((stack, current) => {
        if (typeof current.initialized !== 'undefined' && typeof current.initialize !== 'undefined') {
          stack.push(current.initialize())
          current.initialized = true
        }
        return stack
      }, [])
      await Promise.all(reducedApps)
      this.initialized = true
      return this.initialized
    }
  }
}

const resolver = {
  cache: {},
  async get (query) {
    const now = Math.round(new Date() / 1000)
    if (typeof this.cache[query] === 'undefined' || this.cache[query].cached < now - cacheSeconds) {
      this.cache[query] = {
        cached: now,
        explicitTests: {},
        matches: {}
      }

      this.cache[query].explicitTests = {
        emailAddress: is.validEmailAccount(query),
        xrplAccount: is.possibleXrplAccount(query)
      }
    
      const allApps = activeApps.reduce((stack, current) => {
        stack.push(current.get(query))
        return stack
      }, [])
  
      this.cache[query].matches = await Promise.all(allApps).then(r => {
        return r.reduce((stack, current) => {
          current.forEach(c => stack.push(c))
          return stack
        }, [])
      })
    }

    if (is.possibleXrplAccount(query) && query.length >= 20) {
      // Populate backend cache
      knownAccount(app.db, query)
    }

    return Object.assign({
      live: now === this.cache[query].cached
    }, this.cache[query])
  }
}

/**
  * Samples:
  *   rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT
  *   hi<at>wietse.com
  *   WietseWind
  *   pepperew
  *   xrptipbot
  *   tacostand
  */

module.exports = async (handle, req) => {
  if (!app.initialized) {
    log('Initializing')
    await app.initialize(req.config, req.db)
    log('Initialized')
  }

  const resolved = await resolver.get(handle.trim())

  return {
    input: handle,
    ...resolved
  }
}
