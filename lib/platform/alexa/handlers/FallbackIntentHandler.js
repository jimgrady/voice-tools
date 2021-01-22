'use strict'

const BaseHandler = require('./BaseHandler')

class FallbackIntentHandler extends BaseHandler {
  static intentName () {
    return 'AMAZON.FallbackIntent'
  }

  process () {
    return this.templateRespond('fallback', {}, false)
  }
}

module.exports = FallbackIntentHandler
