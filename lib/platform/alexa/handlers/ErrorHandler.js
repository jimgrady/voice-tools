const BaseHandler = require('./BaseHandler');
class ErrorHandler extends BaseHandler {
    static canHandle() {
        return true;
    }
    handle(handlerInput, error) {
        if (error && (typeof error.toString() === 'function')) {
            this._analyticsProperties._error = error.toString();
        }
        return this.before()
            .then(() => {
                this.catchRespond('error', error);
            });
    }
}

module.exports = ErrorHandler;