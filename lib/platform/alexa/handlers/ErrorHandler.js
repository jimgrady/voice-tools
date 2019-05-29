const BaseHandler = require('./BaseHandler');
class ErrorHandler extends BaseHandler {
    static canHandle() {
        return true;
    }
    handle(handlerInput, error) {
        return this.catchRespond(this.template('error'), error);
    }
}

module.exports = ErrorHandler;