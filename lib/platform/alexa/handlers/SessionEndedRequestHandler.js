const BaseHandler = require('./BaseHandler');

/* For an audio playback skill, this needs to be separate from StopIntentHandler.
The session will end while the playback continues, and we don't want to interrupt
playback by saying "Goodbye" etc */
class SessionEndedRequestHandler extends BaseHandler {
    static requestType() {
        return 'SessionEndedRequest';
    }
    // superclass handle method calls before(), process(), after()
    process() {
        //dialog session will end after starting audio playback - we don't want to say "goodbye" in the middle of that
        return this.emptyResponse();
    }
}

module.exports = SessionEndedRequestHandler;