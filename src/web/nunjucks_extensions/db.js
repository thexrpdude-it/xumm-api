const nunjucks = require('nunjucks')

class dbExtension {
  constructor (expressApp) {
    this.tags = [ 'db' ]
    this.parse = (parser, nodes, lexer) => {
      const tok = parser.nextToken()
      const args = parser.parseSignature(null, true)
      parser.advanceAfterBlockEnd(tok.value)
      const body = parser.parseUntilBlocks('error', 'enddb')
      let errorBody = null
      if (parser.skipSymbol('error')) {
        parser.skip(lexer.TOKEN_BLOCK_END)
        errorBody = parser.parseUntilBlocks('enddb')
      }
      parser.advanceAfterBlockEnd()
      return new nodes.CallExtensionAsync(this, 'run', args, [ body, errorBody ])
    }

    this.run = async function () {
      if (arguments.length < 6) {
        var [ context, query, body, errorBody, cb ] = arguments
      } else {
        var [ context, query, args, body, errorBody, cb ] = arguments
      }

      let results
      let response
      let err

      await expressApp.db(query, args || {}).then(res => {
        results = res.map(r => {
          return { ...r }
        })
        context.ctx.results = results // Assign before rendering body()
        response = new nunjucks.runtime.SafeString(body())
      }).catch(e => {
        context.ctx.error = e.message
        // If soft
        response = new nunjucks.runtime.SafeString(errorBody())
        // If hard error
        // err = new Error('Shit hits the fan')
      })

      cb(err, response)
    }  
  }
}

module.exports = dbExtension
