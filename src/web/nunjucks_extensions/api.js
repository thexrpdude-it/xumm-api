const nunjucks = require('nunjucks')
const apis = {
  payloadData: require('@api/v1/internal/payload-data')
}

class apiExtension {
  constructor (expressApp, invoker) {
    this.tags = [ 'api' ]
    this.parse = (parser, nodes, lexer) => {
      const tok = parser.nextToken()
      const args = parser.parseSignature(null, true)
      parser.advanceAfterBlockEnd(tok.value)
      const body = parser.parseUntilBlocks('error', 'endapi')
      let errorBody = null
      if (parser.skipSymbol('error')) {
        parser.skip(lexer.TOKEN_BLOCK_END)
        errorBody = parser.parseUntilBlocks('endapi')
      }
      parser.advanceAfterBlockEnd()
      return new nodes.CallExtensionAsync(this, 'run', args, [ body, errorBody ])
    }

    this.run = async function () {
      if (arguments.length < 6) {
        var [ context, method, body, errorBody, cb ] = arguments
      } else {
        var [ context, method, args, body, errorBody, cb ] = arguments
      }

      let results
      let response
      let err

      if (Object.keys(apis).indexOf(method) > -1) {
        // const apiResponse = apis.payloadData.apply(null, args)
        try {
          let uuid = ''
          if (typeof args === 'object' && args !== null) uuid = args.uuid || ''
          if (typeof args === 'string') uuid = args
          context.ctx.results = await apis[method](uuid, expressApp, invoker) // Assign before rendering body()
          response = new nunjucks.runtime.SafeString(body())
        } catch (e) {
          // Handle soft error
          context.ctx.error = e.message
          response = new nunjucks.runtime.SafeString(errorBody())
          // If hard error
          // err = new Error('Shit hits the fan')
        }
      } else {
        // Handle hard error (err)
        err = new Error(`API method [ ${method} ] is undefined`)
        context.ctx.error = err.message
        response = new nunjucks.runtime.SafeString(errorBody())
      }

      cb(err, response)
    }  
  }
}

module.exports = apiExtension
