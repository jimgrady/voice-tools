'use strict';

const BaseHandler = require('./BaseHandler');

class LaunchRequestHandler extends BaseHandler {
    static requestType() {
        return 'LaunchRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        try {
            if ((!this.getState("lifecycle")) || (this.getState("lifecycle") === 'new')) {
                return this.setState({"lifecycle": 'returning'})
                    .then(_ => {
                        return this.templateRespond('launch-new', {}, false);
                    })
                    .catch(e => {
                        this.log('ERROR', 'LAUNCH REQUEST ERROR', e, e.stack);
                    })

            } else {
                return this.templateRespond('launch-returning', {}, false);
            }
        } catch (e) {
            this.log('ERROR', 'LAUNCH REQUEST ERROR 2', e, e.stack);
        }

    }
}

module.exports = LaunchRequestHandler;