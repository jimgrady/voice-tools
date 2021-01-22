'use strict'

const BaseHandler = require('./BaseHandler')

class LoadTestStateIntentHandler extends BaseHandler {
  // superclass handle method calls before(), process(), after()
  static intentName () {
    return 'VFS_LoadTestState'
  }

  process () {
    // attributes, key, table, view, transform, id
    const self = this
    const testStateId = self.slotValue('TestStateId')
    if (testStateId == 999) {
      return self.replaceState(self.defaultState())
        .then(() => {
          return self.respond('OK, I set the user state back to the default. Reopen the skill to continue.', true)
        })
    }
    return self.content.fetchTable(
      'States',
      'Grid view',
      record => {
        const out = {}
        Object.keys(record.fields).forEach(field => {
          if (record.get(field)) {
            out[field] = record.get(field)
          }
        })
        return {
          id: record.get('Id'),
          data: out
        }
      },
           `{Id} = ${testStateId}`,
           1
    )
      .then(records => {
        const state = records[Object.keys(records)[0]]
        if (!state) {
          throw ('state not found')
        }
        self.log('USERSTATE', `set state to ${JSON.stringify(state, null, 2)}`)
        return self.setState(state)
      })
      .then(result => {
        return self.respond(`OK, I loaded test state ${testStateId}. Reopen the skill to continue.`, true)
      })
      .catch(error => {
        return self.respond(`could not load user state for ${testStateId}: ${error}`)
      })
  }
}

module.exports = LoadTestStateIntentHandler
