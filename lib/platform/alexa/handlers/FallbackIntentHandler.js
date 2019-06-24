const BaseHandler = require('./BaseHandler');

class FallbackIntentHandler extends BaseHandler {
    static intentName() {
        return 'AMAZON.FallbackIntent';
    }

    process() {
        return this.templateRespond('unhandled-request', {}, true);
    }
}

module.exports = FallbackIntentHandler;