const BaseHandler = require('./BaseHandler');

class StopIntentHandler extends BaseHandler {
    static intentName() {
        return ['AMAZON.CancelIntent', 'AMAZON.StopIntent'];
    }
    static requestType() {
        return 'IntentRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        return this.templateRespond('stop', {}, true);
    }
}

module.exports = StopIntentHandler;