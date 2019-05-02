const content = require('../../../content/airtable');
const utils = require('../../../utils');
class BaseHandler {
    constructor(handlerInput) {
        this.handlerInput = handlerInput;
        this.content = content;
        this.utils = utils;
    }
    template(id, tempData) {
        return content.template(id, this.templateData(tempData));
    }
    slotId(slotName) {
        const request = this.handlerInput.requestEnvelope.request;
        if (!request.intent) {
            return null;
        }
        const slots = request.intent.slots;
        let resolution = slots[slotName].resolutions.resolutionsPerAuthority[0];
        return resolution.status.code === 'ER_SUCCESS_MATCH' ? resolution.values[0].value.id : null;
    }
    catchRespond(speechText, error) {
        if (utils.isDev) {
            speechText = `${speechText}. error: ${error}`;
        }
        return this.respond(speechText, true);
    }
    respond(speechText, shouldEndSession) {
        let endSession = !!shouldEndSession;
        return this.handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(endSession)
            .getResponse();
    }
    loadAttributes() {
        return this.handlerInput.attributesManager.getPersistentAttributes()
            .then((attributes) => {
               this.attributes = attributes;
               return Promise.resolve();
            });
    }
    saveAttributes() {
        this.handlerInput.attributesManager.setPersistentAttributes(this.attributes);
        return this.handlerInput.attributesManager.savePersistentAttributes();
    }
    handle() {
        return this.before()
            .then((input) => {
                if (input && input.outputSpeech) {
                    //error during preprocessing generated a response already - don't call the handler instance process method
                    return input;
                } else {
                    return this.process();
                }
            });
    }
    before() {
        return Promise.resolve();
    }
    static canHandle(handlerInput) {
        let request = handlerInput.requestEnvelope.request;
        return request.type === this.requestType()
            && ((!this.intentName()) || (request.intent.name === this.intentName()))
    }
    static intentName() {
        return null;
    }
    speechText() {
        return 'response not yet configured for this intent';
    }
    slotValue(slot) {
        const request = this.handlerInput.requestEnvelope.request;
        if (!request.intent) {
            return null;
        }
        const slots = request.intent.slots;
        return slots[slot].value;
    }
    process() {
        return this.respond(this.speechText());
    }
}
module.exports = BaseHandler;