const BaseHandler = require('./BaseHandler');

class LaunchRequestHandler extends BaseHandler {
    static requestType() {
        return 'LaunchRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        try {
            if ((!this.attributes.state.lifecycle) || (this.attributes.state.lifecycle === 'new')) {
                this.attributes.state.lifecycle = 'returning';
                return this.saveAttributes()
                    .then(_ => {
                        return this.templateRespond('launch-new', this.attributes.state);
                    })
                    .catch(e => {
                        this.log('ERROR', 'LAUNCH REQUEST ERROR', e, e.stack);
                    })
            } else {
                return this.templateRespond('launch-returning', this.attributes.state);
            }
        } catch (e) {
            this.log('ERROR', 'LAUNCH REQUEST ERROR 2', e, e.stack);
        }

    }
}

module.exports = LaunchRequestHandler;