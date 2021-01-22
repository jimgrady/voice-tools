'use strict'

const BaseHandler = require('./BaseHandler')

class StopIntentHandler extends BaseHandler {
  static intentName () {
    // NOTE: with StopIntent, you must end the session. With CancelIntent it's optional
    // simple skills handle both the same, more complex might split them out
    return ['AMAZON.CancelIntent', 'AMAZON.StopIntent']
  }

  process () {
    return this.templateRespond('stop', {}, true)
  }
}

module.exports = StopIntentHandler
