const BaseHandler = require('./BaseHandler');

class LaunchRequestHandler extends BaseHandler {
    static requestType() {
        return 'LaunchRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        console.log('LAUNCH REQUEST PROCESSING');
        try {
            if (!this.attributes.state.lifecycle) {
                this.attributes.state.lifecycle = 'returning';
                return this.saveAttributes()
                    .then(_ => {
                        return this.templateRespond('launch-new', this.attributes.state);
                    })
                    .catch(e => {
                        console.log('LAUNCH REQUEST ERROR', e, e.stack);
                    })
            } else {
                return this.templateRespond('launch-returning-connected', this.attributes.state);
            }
        } catch (e) {
            console.log('LAUNCH REQUEST ERROR 2', e, e.stack);
        }

    }
}

module.exports = LaunchRequestHandler;