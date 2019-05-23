const logws = require('debug')('app:web:ws')

const express = require('express')

module.exports = async function (expressApp) {
  require('express-ws')(expressApp)

  /**
   * WebSocket Router
   */
  const router = express.Router()

  router.ws('/sign/:uuid([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})', (ws, req) => {
    if (typeof req.params.uuid !== undefined) {
      req.db(`
        UPDATE payloads
        SET payload_ws_opencount = payload_ws_opencount + 1
        WHERE  call_uuidv4 = :call_uuidv4
        LIMIT 1
      `, { call_uuidv4: req.params.uuid }).then(r => {
        if (r.constructor.name === 'OkPacket' && typeof r.changedRows !== undefined && r.changedRows > 0) {
          logws('Websocket connected:', req.params.uuid)
          const pubSubChannel = `sign:${req.params.uuid}`
    
          ws.sendJson = (data) => {
            const json = JSON.stringify(data)
            ws.send(json)
          }
    
          const redisMessageHandler = expressApp.redis.subscribe(pubSubChannel, (message) => {
            try {
              const json = JSON.parse(message)
              logws(`  < PubSub MSG @ [ ${pubSubChannel} ]`, json)
              ws.sendJson(json)
            } catch (e) {
              logws(`  < PubSub MSG @ [ ${pubSubChannel} ] ! NON JSON`)
            }
          })
    
          ws.sendJson({ message: `Welcome ` + req.params.uuid })
          ws.on('close', () => {
            logws('Bye', req.params.uuid)
            redisMessageHandler.destroy()
          })
          ws.on('message', (msg) => {
            logws(`Got WebSocket message from [ ${req.params.uuid} ] `, msg)
            ws.sendJson({ message: `Right back at you!` })
          })
        }
      })
    }
  })

  // Use
  expressApp.use('/wss', router)
}
