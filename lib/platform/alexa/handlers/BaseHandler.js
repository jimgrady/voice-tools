'use strict'

const content = require('../../../content/airtable');
const utils = require('../../../utils');
const platformUtils = require('../lib/util.js');
class BaseHandler {
    constructor(handlerInput, config, logInstance) {
        this.config = config;
        this.utils = utils;
        this.platformUtils = platformUtils;
        this.logInstance = logInstance;
        if (!handlerInput) {
            throw "handlerInput is required to construct a handler";
        }
        if (!config) {
            throw "config is required to construct a handler";
        }
        this.handlerInput = handlerInput;
        this.content = new content(config);
        this.attributesManager = this.handlerInput.attributesManager;
    }
    log() {
        this.logInstance.log.apply(this.logInstance, arguments);
    }
    template(id, tempData) {
        let out = this.content.template(id, this.templateData(tempData));
        if (out) {
            //newlines cause a long pause, quotes must be encoded in SSML
            out = out
                .replace(/\n/g, ' ')
                .replace(/(")(?![^<]*>|[^<>]*<\/)/g, '&quot;')
        }
        if (!out) {
            out = `could not load content from ${id}. Check that all replacements are available for: (${this.attributes.uiTemplates[id]})`;
        }
        return out;
    }
    templateRespond(id, tempData, endSession) {
        if (endSession === null) {
            endSession = true;
        }
        let output = this.template(id, tempData);
        return this.respond(output, endSession);
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
    catchRespond(speech, error) {
        let speechText = this.attributes && this.attributes.uiTemplates ? this.template(speech) : speech;
        if (this.config.isDev) {
            speechText = `${speechText}. error: ${error}`;
        }
        return this.respond(speechText, true);
    }
    emptyResponse() {
        return this.handlerInput.responseBuilder.getResponse();
    }
    respond(speechText, shouldEndSession) {
        return this.response(speechText, shouldEndSession)
            .getResponse();
    }
    response(speechText, shouldEndSession) {
        let endSession = !!shouldEndSession;
        return this.handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(endSession);
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
                            this.log('ERROR', `${e.message}\nSTACK:${e.stack}`);
                            process.exit();
                        } else {
                            throw(e);
                        }
                    }
                }
            });
    }
    static canHandle(handlerInput) {
        if (!handlerInput) {
            throw "Input not passed to canHandle";
        }
        let request = handlerInput.requestEnvelope.request;
        let requestType = this.requestType();
        if (!requestType) {
            throw("static requestType() must be defined in handler class " + this);
        }
        let typeMatches = false;
        if (Array.isArray(requestType)) {
            typeMatches = requestType.indexOf(request.type) !== -1;
        } else if (request.type[requestType.length -1] === '.') {
            //request type ending in a dot indicates the handler can take all types of requests starting with x, e.g. AudioPlayer.
            typeMatches = request.type.startsWith(requestType);
        } else {
            typeMatches = request.type === requestType;
        }
        let nameCheck = true;
        if (request.type === 'IntentRequest') {
            nameCheck = false;
            let requestedIntent = request.intent.name;
            let intentName = this.intentName();
            if (!intentName) {
                nameCheck = false;
            } else if (Array.isArray(intentName)) {
                nameCheck = intentName.indexOf(requestedIntent) !== -1;
            } else if (intentName[intentName.length -1] === '.') {
                //request type ending in a dot indicates the handler can take all types of requests starting with x, e.g. AudioPlayer.
                nameCheck = requestedIntent.startsWith(intentName);
            } else {
                nameCheck = (requestedIntent === intentName);
            }
        } else {
            nameCheck = true
        }
        let can = typeMatches && nameCheck;
        return can;
    }
    static intentName() {
        return null;
    }
    speechText() {
        return 'speech output has not been configured for this intent yet';
    }
    templateId() {
        return this.className().split(/[A-Z]/).replace(/Handler$/, '').split(/(?=[A-Z])/).join('-').toLowerCase();
    }
    slotValue(slot) {
        const request = this.handlerInput.requestEnvelope.request;
        if (!request.intent) {
            return null;
        }
        const slots = request.intent.slots;
        return slots[slot].value;
    }
    allSlotValues() {
        const slotValues = {};
        const request = this.handlerInput.requestEnvelope.request;
        if (!(request.intent && request.intent.slots)) {
            return slotValues;
        }
        const slots = request.intent.slots;
        Object.keys(slots).forEach(key => {
            slotValues[key] = slots[key].value;
        });
        return slotValues;
    }
    process() {
        return this.respond(this.speechText());
    }

    templateData(overrides) {
        if (typeof this.attributes.uiTemplates === 'undefined') {
            throw('No ui template data loaded');
        }
        //uiTemplates, factTemplates, factSet, userState
        let data = Object.assign({}, this.attributes.uiTemplates);

        if (typeof this.attributes.factTemplates !== 'undefined') {
            for (let key in this.attributes.factTemplates) {
                let responseKey = `${key}-response`;
                data[responseKey] = this.attributes.factTemplates[key].template;
            }
        }

        if (typeof this.attributes.factSet !== 'undefined') {
            data = Object.assign(data, this.attributes.factSet);
        }

        if (typeof this.attributes.userState !== 'undefined') {
            data = Object.assign(data, this.attributes.userState);
        }

        data = Object.assign(data, this.allSlotValues());

        if (overrides) {
            data = Object.assign(data, overrides);
        }

        return data;
    }


    before() {
        return this.loadAttributes()
            .then(() => {
                return this.loadTemplates();
            })
            .then(() => {
                return this.saveAttributes();
            })
            .catch((error) => {
                return this.catchRespond(
                    `Sorry, I'm still setting a few things up. I should be ready in a couple of seconds. To try again, please say 'Alexa, open ${this.config.invocationName}.'`,
                    error
                );
            });
    }

    loadTemplates() {
        if (!this.attributes.state) {
            this.attributes.state = {};
        }
        if (!this.attributes.uiTemplates) {
            this.attributes.uiTemplates = this.config.uiTemplates;
        }
        if (this.config.airtableBaseId) {
            return this.content.loadUiTemplates(this.attributes, this.isLaunchRequest())
                .then(_ => {
                    this.attributes.uiTemplates["invocation-name"] = this.config.invocationName;
                })
                .catch((error) => {
                    this.log('ERROR', error);
                });
        } else {
            this.attributes.uiTemplates["invocation-name"] = this.config.invocationName;
            return Promise.resolve();
        }

    }

    isLaunchRequest() {
        const request = this.handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest';
    }

    callApi(version, path) {
        return this.platformUtils.callApi(version, path, this.handlerInput);
    }

    setState(state) {
        if (Object.keys(state).length === 0) {
            return Promise.resolve();
        }
        let sessionAttributes = this.attributesManager.getSessionAttributes();
        if (!sessionAttributes.state) {
            sessionAttributes.state = {};
        }
        Object.assign(sessionAttributes.state, state);
        this.attributesManager.setSessionAttributes(sessionAttributes);
        Object.assign(this.attributes.state, state);
        return this.saveAttributes();
    }
    getState() {
        let sessionAttributes = this.attributesManager.getSessionAttributes() || {};
        return sessionAttributes.state || {};
    }

    static className() {
        return this.toString().split ('(' || /s+/)[0].split (' ' || /s+/)[1];
    }

}
module.exports = BaseHandler;