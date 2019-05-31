const BaseHandler = require('./BaseHandler');

class StopIntentHandler extends BaseHandler {
    static canHandle(handlerInput) {
        return this.isStopRequest(handlerInput);
    }
    // superclass handle method calls before(), process(), after()
    process() {
        return this.templateRespond('goodbye', {}, true);
    }
}

module.exports = StopIntentHandler;