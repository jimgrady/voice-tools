'use strict'

const BaseHandler = require('./BaseHandler')

class SessionEndedRequestHandler extends BaseHandler {
  static requestType () {
    return 'SessionEndedRequest'
  }

  process () {
    // not possible to emit a response, the session is already ended - just send empty response acknowledging receipt
    return this.emptyResponse() // TODO: wrap in this.respond() or no?
  }
}

module.exports = SessionEndedRequestHandler
