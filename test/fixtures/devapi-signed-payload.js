module.exports = expect.objectContaining({
  "application":{
    "description": expect.any(String),
    "disabled": expect.any(Number),
    "icon_url": expect.any(String),
    "issued_user_token": expect.any(String),
    "name": expect.any(String),
    "uuidv4": expect.any(String)
  },
  "meta":{
    "app_opened": expect.any(Boolean),
    "cancelled": true,
    "destination": expect.any(String),
    "exists": true,
    "expired": true,
    "multisign": false,
    "pushed": expect.any(Boolean),
    "resolved": true,
    "resolved_destination": expect.any(String),
    "return_url_app": expect.any(String),
    "return_url_web": expect.any(String),
    "signed": true,
    "submit": expect.any(Boolean),
    "uuid": expect.any(String)
  },
  "custom_meta":{
    "identifier": expect.any(String),
    "blob": {
      test: true
    },
    "instruction": "Sign Please"
  },
  "payload":{
    "created_at": expect.any(String),
    "expires_at": expect.any(String),
    "expires_in_seconds": expect.toBeWithinRange(-100, 10000),
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
    "account": expect.any(String),
    "dispatched_result": "tes_SUCCESS",
    "dispatched_to": "wss://xrpl.ws",
    "hex": expect.any(String),
    "multisign_account": "",
    "resolved_at": expect.any(String),
    "txid": expect.any(String)
  }
})
