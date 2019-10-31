'use strict';

const content = require('../../../content/airtable');
const utils = require('../../../utils');
const platformUtils = require('../lib/util.js');
const Base = require('../../../Base');
class BaseHandler extends Base {
    constructor(handlerInput, config, logInstance) {
        super(logInstance);
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
        this.content = new content(config);
        this.attributes = {};
        this.attributesManager = this.handlerInput.attributesManager;
    }
    template(id, tempData, keepNewLines) {
        const self = this;
        let out = this.content.template(id, this.templateData(tempData));
        if (out) {
            //newlines cause a long pause, quotes must be encoded in SSML
            if (!keepNewLines) {
                out = out.replace(/\n/g, ' ');
            }
            out = out.replace(/(")(?![^<]*>|[^<>]*<\/)/g, '&quot;')
        }
        if (this.attributes === 'undefined') {
            throw('ATTUNDEF 1');
        }
        if (!out) {
            const debugMessage = `could not load content from ${id}. Check that all replacements are available for: (${this.attributes.uiTemplates[id]})`;
            if (self.config.missingInfoErrorTemplate) {
                self.log('ERROR', debugMessage);
                out = self.template(self.config.missingInfoErrorTemplate);
            } else {
                out = debugMessage;
            }
        }
        return out;
    }
    templateRespond(id, tempData, endSession = true, repromptId = null) {
        let out = this.templateResponse(id, tempData, endSession, repromptId);
        return out.getResponse();
    }
    templateResponse(id, tempData, endSession = true, repromptId = null) {
        let speechText = this.template(id, tempData);
        let repromptText;
        if (!endSession) {
            if (repromptId) {
                repromptText = this.template(repromptId, tempData);
            } else if (this.standardReprompt) {
                repromptText = this.template(this.standardReprompt, tempData);
            }
        }
        return this.response(speechText, endSession, repromptText);
    }
    slots() {
        let request = this.handlerInput.requestEnvelope.request, slots;
        if (request && request.intent && request.intent.slots) {
            return request.intent.slots;
        } else {
            return {};
        }
    }

    slotId(slotName) {
        const slot = this.slots()[slotName];
        if (!(slot && slot.resolutions)) {
            return null;
        }
        let resolution = slot.resolutions.resolutionsPerAuthority[0];
        return resolution.status.code === 'ER_SUCCESS_MATCH' ? resolution.values[0].value.id : null;
    }
    catchRespond(speech, error, endSession, tempData) {
        if (endSession === undefined) {
            endSession = true;
        }
        //let speechText = this.attributes && this.attributes.uiTemplates ? this.template(speech) : speech;
        let speechText = this.template(speech, tempData);
        if (!speechText) {
            speechText = 'error with no description';
        }
        if (this.config.isDev && error !== undefined) {
            speechText = `${speechText}. error: ${error}`;
        }
        return this.respond(speechText, endSession);
    }
    emptyResponse() {
        return this.handlerInput.responseBuilder.getResponse();
    }
    respond(speechText, shouldEndSession = false, repromptText = null) {
        let out = this.response(speechText, shouldEndSession, repromptText);
        return out.getResponse();
    }
    response(speechText, endSession = false, repromptText = null) {
        let out = this.handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(endSession);
        if ((typeof repromptText !== 'undefined') && repromptText) {
            out.reprompt(repromptText);
        }
        return out;
    }
    loadAttributes() {
        return this.attributesManager.getPersistentAttributes()
            .then((attributes) => {
               this.attributes = attributes || {};
               return Promise.resolve();
            })
            .catch(error => {
                this.attributes = this.attributes || {};
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
    static requestType() {
        return 'IntentRequest';
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
    slotValue(slotName) {
        const slot = this.slots()[slotName];
        if (!slot) {
            return null;
        }
        return slot.value;
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
        //start with hard-coded templates;

        let data = this.config.uiTemplates;

        if (this.attributes !== undefined) {
            // then add uiTemplates (cms templates), factTemplates, factSet, userState
            if (typeof this.attributes.uiTemplates !== 'undefined') {
                Object.assign(data, this.attributes.uiTemplates);
            }

            if (typeof this.attributes.factTemplates !== 'undefined') {
                for (let key in this.attributes.factTemplates) {
                    let responseKey = `${key}-response`;
                    data[responseKey] = this.attributes.factTemplates[key].template;
                }
            }

            if (typeof this.attributes.factSet !== 'undefined') {
                data = Object.assign(data, this.attributes.factSet);
            }
        }

        data = Object.assign(data, this.getState());

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
                return this.loadState();
            })
            .then(() => {
                return this.saveAttributes();
            })
            .then(() =>  {
                return Promise.resolve(this.beforeResponse());
            })
            .catch((error) => {
                return this.catchRespond(
                    `Sorry, I'm still setting a few things up. I should be ready in a couple of seconds. To try again, please say 'Alexa, open ${this.config.invocationName}.'`,
                    error
                );
            });
    }

    beforeResponse() {
        return null;
    }

    loadState() {
        if (Object.keys(this.getState()).length === 0) {
            this.setState(this.defaultState());
        }
        this.loadAccessToken();
        return this.calculateState();
    }

    defaultState() {
        return this.config.defaultState || {};
    }

    calculateState() {
        return Promise.resolve();
    }

    loadTemplates(force) {
        const loadFromCMS = this.config.airtableApiKey && this.config.airtableBaseId;

        if (this.templatesLoaded && (!force)) {
            return Promise.resolve();
        }
        this.config.uiTemplates['invocation-name'] = this.config.invocationName;

        this.templatesLoaded = true;

        if (!loadFromCMS) {
            return Promise.resolve();
        }

        return this.content.loadUiTemplates(this.attributes, this.isLaunchRequest())
            .then(_ => {
                this.attributes.uiTemplates["invocation-name"] = this.config.invocationName;
                return Promise.resolve();
            })
            .catch((error) => {
                this.log('ERROR', error);
                return Promise.resolve();
            });


    }

    isLaunchRequest() {
        const request = this.handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest';
    }

    callApi(version, path) {
        return this.platformUtils.callApi(version, path, this.handlerInput);
    }

    setState(state, persist = true, saveNow = true) {
        if (Object.keys(state).length === 0) {
            return Promise.resolve();
        }
        if (this.deviceId()) { //add to session for in-session requests - todo - maybe separate session
            let sessionAttributes = this.attributesManager.getSessionAttributes();
            if (!sessionAttributes.state) {
                sessionAttributes.state = {};
            }
            Object.assign(sessionAttributes.state, state);
            this.attributesManager.setSessionAttributes(sessionAttributes);
        }
        if (persist) {
            Object.assign(this.attributes.state, state);
            if (saveNow) {
                return this.saveAttributes();
            }
        }
        return Promise.resolve();
    }
    replaceState(state) {
        this.attributesManager.setSessionAttributes(state);
        this.attributes.state = state;
        return this.saveAttributes();
    }
    getState(key = null) {
        let sessionAttributes = this.attributesManager.getSessionAttributes() || {};
        if (!key) {
            let out = {};
            if (this.attributes.state) {
                out = Object.assign({}, this.attributes.state);
            }
            if (sessionAttributes.state) {
                out = Object.assign(out, sessionAttributes.state)
            }
            return out;
        }
        if (sessionAttributes.state && sessionAttributes.state.hasOwnProperty(key)) {
            return sessionAttributes.state[key];
        }
        if (!this.attributes.state) {
            return null;
        }
        return this.attributes.state[key];
    }

    static className() {
        return this.toString().split ('(' || /s+/)[0].split (' ' || /s+/)[1];
    }

    stateMatches(state, name) {
        // name optional is for debug/info purposes
        this.log('DEBUG', `checking state match ${name} on ${JSON.stringify(state)}`);
        for (let key in state) {
            let val = state[key];
            if (Array.isArray(val)) {
                if (val.indexOf(this.getState(key)) === -1) {
                    this.log('DEBUG', `failed on ${key}: current state ${this.getState(key)} not in array ${val.join(', ')}`);
                    return false;
                }
            } else if (this.getState(key) !== val) {
                this.log('DEBUG', `failed on ${key}: current state ${this.getState(key)} !== ${val}`);
                return false;
            }
        }
        this.log('DEBUG', `${name} matched`);
        return true;
    }

    deviceId() {
        const self = this;
        const input = self.handlerInput;
        let id;
        try {
            id = input["requestEnvelope"]["context"]["System"]["device"]["deviceId"];
        } catch(e) {
            // out of session request
            id = null;
        }
        return id;
    }

    systemInput() {
        // noinspection JSUnresolvedVariable
        return this.handlerInput.requestEnvelope.context.System;
    }

    permissionsInput() {
        return this.systemInput()["permissions"];
    }

    userInput() {
        return this.systemInput()["user"];
    }

    consentToken() {
        try {
            // noinspection JSUnresolvedVariable
            return this.permissionsInput().consentToken;
        } catch(e) {
            return null;
        }
    }

    loadAccessToken() {
        //this.accessToken = 'ya29.GlyIB-QA-3YMtARcYghXbGZPnqclYpYK8z7TW0BpfylNCWTdAfIXDy-S3daq7pI5pX_oipocxBjeONuUQGNKpATcABXOF1tNSlchGmT3u2cwJEEziB2sQ1uR-ZPUdA';
        if (this.config.hasOwnProperty('testAccessToken')) {
            this.accessToken = this.config.testAccessToken;
            this.attributes.state['account-linked'] = !!this.accessToken;
            return;
        }
        try {
            // noinspection JSUnresolvedVariable
            let accessToken = this.userInput().accessToken;
            if (accessToken) {
                this.attributes.state['account-linked'] = true;
                this.accessToken = accessToken;
            } else {
                this.attributes.state['account-linked'] = false;
            }
        } catch(e) {
            this.log('DEBUG', `error checking for access token ${e}`);
        }

    }

    locale() {
        const self = this;
        let out;
        try {
           out = self.handlerInput.request.locale;
        } catch (e) {
            out = self.config.defaultLocale;
        }
    }

    confirmationStatus() {
        let request = this.handlerInput.requestEnvelope.request;
        if (!request.intent) {
            return null;
        }
        return request.intent.confirmationStatus;
    }
}
module.exports = BaseHandler;