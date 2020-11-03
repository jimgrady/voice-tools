'use strict';

const BaseHandler = require('./BaseHandler');

class HelpIntentHandler extends BaseHandler {
    // superclass handle method calls before(), process(), after()
    static intentName() {
        return 'AMAZON.HelpIntent';
    }
    process() {
        return this.templateRespond('help', {}, false);
    }
}

module.exports = HelpIntentHandler;