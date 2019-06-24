const BaseHandler = require('./BaseHandler');

class StopIntentHandler extends BaseHandler {
    static intentName(handlerInput) {
        return ['AMAZON.CancelIntent', 'AMAZON.StopIntent'];
    }
    // superclass handle method calls before(), process(), after()
    process() {
        return this.templateRespond('goodbye', {}, true);
    }
}

module.exports = StopIntentHandler;