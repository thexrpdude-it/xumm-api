module.exports = expect.objectContaining({
  "application":{
      "description": expect.any(String),
      "disabled": expect.any(Number),
      "icon_url": expect.any(String),
      "issued_user_token":null,
      "name": expect.any(String),
      "uuidv4": expect.any(String)
  },
  "meta":{
      "app_opened":false,
      "destination": expect.any(String),
      "exists": true,
      "expired": true,
      "finished": false,
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
      "expires_in_seconds": expect.toBeWithinRange(-100, 0),
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
      "account": null,
      "dispatched_result": null,
      "dispatched_to": null,
      "hex": null,
      "multisign_account": null,
      "resolved_at": null,
      "txid": null
  }
})
