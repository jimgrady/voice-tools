"use strict";

const content = require('../../../content/airtable');
const utils = require('../../../utils');
const platformUtils = require('../lib/utils')
const attributesManager = require('../lib/AttributesManager.js')
//handlerInput == conv
class BaseHandler {
    constructor(handlerInput, config) {
        this.handlerInput = handlerInput;
        this.config = config;
        this.content = new content(config);
        this.utils = utils;
        this.attributesManager = new attributesManager(handlerInput, config);
    }
    template(id, tempData) {
        return this.content.template(id, this.templateData(tempData));
    }
    templateRespond(id, tempData, endSession) {
        return this.respond(this.template(id, tempData), endSession);
    }
    slotId(slotName) {
        console.log("SLOT ID SUPPORTED? NOT IMPLEMENTED YET")
    }
    catchRespond(speechText, error) {
        if (this.config.isDev) {
            speechText = `${speechText}. error: ${error}`;
        }
        return this.respond(speechText, true);
    }
    respond(speechText, shouldEndSession) {
        let endSession = !!shouldEndSession;
        this.handlerInput.add(speechText);
        if (endSession) {
            this.handlerInput.close();
        }
    }
    loadAttributes() {
        return this.attributesManager.getPersistentAttributes()
            .then((attributes) => {
                this.attributes = attributes;
                return Promise.resolve();
            });
    }
    saveAttributes() {
        this.attributesManager.setPersistentAttributes(this.attributes);
        return this.attributesManager.savePersistentAttributes();
    }
    handle() {
        return this.before()
            .then((input) => {
                if (input && input.outputSpeech) {
                    //error during preprocessing generated a response already - don't call the handler instance process method
                    return input;
                } else {
                    try {
                        return this.process();
                    } catch(e) {
                        if (this.config.isDev) {
                            console.log(`ERROR:\n${e.message}\nSTACK:${e.stack}`);
                            process.exit();
                        } else {
                            throw(e);
                        }
                    }
                }
            });
    }
    before() {
        return this.attributesManager.getAttributes()
            .then((attributes) => {
               this.attributes = attributes;
               return Promise.resolve();
            });
    }
    static canHandle(handlerInput) {
        let request = handlerInput.requestEnvelope.request;
        let requestType = this.requestType();
        if (!requestType) {
            throw("requestType() must be defined in handler class " + this);
        }
        let can = request.type === requestType
            && ((!this.intentName()) || (request.intent.name === this.intentName()))
        return can;
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
    static isStopRequest(handlerInput) {
        return (handlerInput.requestEnvelope.request.type === 'IntentRequest' == 'SessionEndedRequest')
            || handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    }
    process() {
        return this.respond(this.speechText());
    }
}
module.exports = BaseHandler;