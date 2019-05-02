const BaseHandler = require('./BaseHandler');
class ErrorHandler extends BaseHandler {
    static canHandle() {
        return true;
    }
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        let speechText = "Sorry, I'm having some trouble. Please try again, or say goodbye and then 'Open Property Details' again.";//error; //content.uiString('error', {});
        return this.respond(speechText);
    }
}

module.exports = ErrorHandler;