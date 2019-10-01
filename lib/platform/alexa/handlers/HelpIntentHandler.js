const BaseHandler = require('./BaseHandler');

class HelpIntentHandler extends BaseHandler {
    // superclass handle method calls before(), process(), after()
    static intentName() {
        return 'AMAZON.HelpIntent';
    }
    static requestType() {
        return 'IntentRequest';
    }
    process() {
        return this.respond(this.template('help'));
    }
}

module.exports = HelpIntentHandler;