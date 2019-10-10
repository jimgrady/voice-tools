const BaseHandler = require('./BaseHandler');
class ErrorHandler extends BaseHandler {
    static canHandle() {
        return true;
    }
    handle(handlerInput, error) {
        return this.before()
            .then(() => {
                this.catchRespond('error', error);
            });
    }
}

module.exports = ErrorHandler;