const BaseHandler = require('./BaseHandler');

class StopIntentHandler extends BaseHandler {
    static intentName() {
        return ['AMAZON.CancelIntent', 'AMAZON.StopIntent'];
    }
    process() {
        return this.templateRespond('stop', {}, true);
    }
}

module.exports = StopIntentHandler;