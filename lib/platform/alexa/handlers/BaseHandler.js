const content = require('../../../content/airtable');
const utils = require('../../../utils');
const platformUtils = require('../lib/util.js');
class BaseHandler {
    constructor(handlerInput, config) {
        this.config = config;
        this.utils = utils;
        this.platformUtils = platformUtils;
        if (!handlerInput) {
            throw "handlerInput is required to construct a handler";
        }
        if (!config) {
            throw "config is required to construct a handler";
        }
        this.handlerInput = handlerInput;
        this.content = content;
        this.attributesManager = this.handlerInput.attributesManager;
    }
    template(id, tempData) {
        return content.template(id, this.templateData(tempData));
    }
    templateRespond(id, tempData, endSession) {
        return this.respond(this.template(id, tempData), endSession);
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
                        if (process.env.ENV_TYPE === 'dev_skill') {
                            console.log(`ERROR:\n${e.message}\nSTACK:${e.stack}`);
                            process.exit();
                        } else {
                            throw(e);
                        }
                    }
                }
            });
    }
    static canHandle(handlerInput) {
        console.log(`CHECKING ${this.name}`);
        if (!handlerInput) {
            throw "Input not passed to canHandle";
        }
        let request = handlerInput.requestEnvelope.request;
        let requestType = this.requestType();
        if (!requestType) {
            throw("static requestType() must be defined in handler class " + this);
        }
        let can = request.type === requestType
            && ((!this.intentName()) || (request.intent.name === this.intentName()))
        console.log(`${this.name} ${can ? "CAN " : 'CANNOT'} HANDLE ${request.type} : ${request.intent ? request.intent.name : '[no name]'}`);
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
        return (
            (handlerInput.requestEnvelope.request.type === 'SessionEndedRequest')
            || (
                (handlerInput.requestEnvelope.request.type === 'IntentRequest')
                && (['AMAZON.CancelIntent', 'AMAZON.StopIntent'].indexOf(handlerInput.requestEnvelope.request.intent.name) != -1)
            )
        );
    }
    process() {
        return this.respond(this.speechText());
    }

    templateData(tempData) {
        if (typeof this.attributes.uiTemplates === 'undefined') {
            throw('No ui template data loaded');
        }
        let data = Object.assign({}, this.attributes.uiTemplates);
        if (typeof this.attributes.factTemplates !== 'undefined') {
            for (let key in this.attributes.factTemplates) {
                let responseKey = `${key}-response`;
                if (data[responseKey]) {
                    throw(`template id conflict: response template id '${responseKey}' already used for a UI template`);
                }
                data[responseKey] = this.attributes.factTemplates[key].template;
            }
        }
        if (typeof this.attributes.currentProperty !== 'undefined') {
            for (let key in this.attributes.currentProperty) {
                if (data[key]) {
                    throw(`template id conflict: fact id '${key}' already used for a UI template`);
                }
                data[key] = this.attributes.currentProperty[key];
            }
        }
        if (tempData) {
            for (let key in tempData) {
                data[key] = tempData[key];
            }
        }
        return data;
    }


    before() {
        return this.loadAttributes()
            .then(() => { return this.loadTemplates(); })
            .then(() => { return this.saveAttributes(); })
            .catch((error) => {
                return this.catchRespond(
                    `Sorry, I'm still setting a few things up. I should be ready in a couple of seconds. To try again, please say 'Alexa, open ${this.config.invocationName}.'`,
                    error
                );
            });
    }

    loadTemplates() {
        return this.content.loadUiTemplates(this.attributes, this.isLaunchRequest())
            .catch((error) => {
                console.log(error);
            });
    }

    isLaunchRequest() {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'LaunchRequest';
    }

    callApi(version, path) {
        return this.platformUtils.callApi(version, path, this.handlerInput);
    };
}
module.exports = BaseHandler;