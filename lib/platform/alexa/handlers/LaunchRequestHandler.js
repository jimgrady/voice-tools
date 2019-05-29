const BaseHandler = require('./BaseHandler');

class LaunchRequestHandler extends BaseHandler {
    static requestType() {
        return 'LaunchRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        console.log('LAUNCH REQUEST');
        return this.templateRespond('welcome-new');
    }
}

module.exports = LaunchRequestHandler;