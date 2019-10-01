const BaseHandler = require('./BaseHandler');

class FallbackIntentHandler extends BaseHandler {
    static intentName() {
        return 'AMAZON.FallbackIntent';
    }

    static requestType() {
        return 'IntentRequest';
    }

    process() {
        return this.templateRespond('fallback', {}, false);
    }
}

module.exports = FallbackIntentHandler;