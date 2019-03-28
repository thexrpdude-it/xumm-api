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

    this.run = async (context, query, body, errorBody, cb) => {
      // return body()
      // const err = new Error('xxxx')
      // console.log(context)
      // context.ctx.results = new nunjucks.runtime.SafeString('DBSOME <b>NICE</b> RESULTS')
      let results
      let response
      let err
      await expressApp.db(query).then(res => {
        results = res.map(r => {
          return { ...r }
        })
        response = new nunjucks.runtime.SafeString(body())
      }).catch(e => {
        context.ctx.error = e.message
        // If soft
        response = new nunjucks.runtime.SafeString(errorBody())
        // If hard error
        // err = new Error('Shit hits the fan')
      })
      context.ctx.results = results
      // context.ctx.error = new nunjucks.runtime.SafeString('DBSOME <b>STRANGE</b> ERROR')
      cb(err, response)
    }  
  }
}

module.exports = dbExtension
