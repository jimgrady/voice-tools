'use strict'

const Base = require('../Base.js')

module.exports = class Analytics {
  constructor (receiverConfig) {
    this.receivers = []
    receiverConfig.forEach(receiver => {
      this.receivers.push(new receiver.class(receiver.config))
    })
  }

  slotsToParams (caller) {
    const slotValues = caller.allSlotValues()
    const slotIds = caller.allSlotIds()
    const out = {}
    Object.keys(slotValues).forEach(key => {
      const value = slotValues[key]
      out[`${key}_Value`] = value
      const id = slotIds[key]
      if (id) {
        out[`${key}_Id`] = id
      }
    })
    return out
  }

  shortenId (id) {
    if (typeof id !== 'string') {
      return id
    }
    return id.substring(id.length - 16)
  }

  async trackEvent (caller, params) {
    const out = []
    try {
      const requestType = caller.request().type
      const intentName = caller.request().intent ? caller.request().intent.name : null
      let intentLabel = ''
      if (params._event) {
        intentLabel = params._event
      } else {
        if (requestType !== 'IntentRequest') {
          intentLabel += requestType
        }
        if (intentName) {
          intentLabel += intentName
        }
      }

      let sendParams = {
        _userId: this.shortenId(caller.userInput().userId),
        _sessionId: this.shortenId(caller.sessionId()),
        _deviceId: this.shortenId(caller.deviceId()),
        _requestId: this.shortenId(caller.requestId()),
        _locale: caller.locale(),
        _intent: intentLabel,
        _handled: true
      }
      const slotParams = this.slotsToParams(caller)
      sendParams = Object.assign(sendParams, slotParams)
      sendParams = Object.assign(sendParams, params)
      console.log(sendParams)
      for (const receiver of this.receivers) {
        out.push(await receiver.trackEvent(sendParams, caller))
      }
      caller.log('INFO', 'ANALYTICS', JSON.stringify(sendParams))
    } catch (e) {
      console.log(e)
      return Promise.reject(e)
    }
    return Promise.resolve(out)
  }
}
