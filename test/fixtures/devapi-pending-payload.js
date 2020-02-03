module.exports = expect.objectContaining({
  "application":{
     "description": expect.any(String),
     "disabled": expect.any(Number),
     "icon_url": expect.any(String),
     "issued_user_token": null,
     "name": expect.any(String),
     "uuidv4": expect.any(String)
  },
  "meta":{
     "app_opened": expect.any(Boolean),
     "destination": expect.any(String),
     "exists": true,
     "expired": false,
     "finished": true,
     "multisign": false,
     "pushed": false,
     "resolved_destination": expect.any(String),
     "return_url_app": expect.any(String),
     "return_url_web": expect.any(String),
     "submit": expect.any(Boolean),
     "uuid": expect.any(String)
  },
  "payload":{
     "created_at": expect.any(String),
     "expires_at": expect.any(String),
     "expires_in_seconds": expect.toBeWithinRange(1, 10000),
     "request_json":{
        "Amount": expect.any(String),
        "Destination": expect.any(String),
        "TransactionType": expect.any(String)
     },
     "tx_destination": expect.any(String),
     "tx_destination_tag": null,
     "tx_type": "Payment"
  },
  "response":{
     "account": "",
     "dispatched_result": "",
     "dispatched_to": "",
     "hex": "",
     "multisign_account": "",
     "resolved_at": expect.any(String),
     "txid": ""
  }
})
