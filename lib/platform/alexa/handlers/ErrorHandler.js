'use strict'

const BaseHandler = require('./BaseHandler')
class ErrorHandler extends BaseHandler {
  static canHandle () {
    return true
  }

  handle (handlerInput, error) {
    if (error && (typeof error.toString() === 'function')) {
      this._analyticsProperties._error = error.toString()
    }
    return this.before()
      .then(() => {
        return this.catchRespond('error', error, false)
      })
  }
}

module.exports = ErrorHandler
