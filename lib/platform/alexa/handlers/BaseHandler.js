'use strict';

const content = require('../../../content/airtable');
const utils = require('../../../utils');
const platformUtils = require('../lib/util.js');
const Base = require('../../../Base');
class BaseHandler extends Base {
    constructor(handlerInput, config, logInstance) {
        if (!handlerInput) {
            throw "handlerInput is required to construct a handler";
        }
        if (!config) {
            throw "config is required to construct a handler";
        }
        super(logInstance);
        this.handlerInput = handlerInput;

        this.config = config;
        this.attributes = {};
        this.standardReprompt = this.config.standardReprompt;
        this.unsavedAttributes = false;

        this.utils = utils;
        this.platformUtils = platformUtils;
        this.content = new content(config);
        this.attributesManager = this.handlerInput.attributesManager;
        this.analytics = this.config.analytics;
        this._analyticsProperties = {_speaker: 'user'};
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
            const debugMessage = `could not load content from ${id}. Check that all replacements are available for: (${this.uiTemplates[id]})`;
            if (self.config.isDev) {
                out = debugMessage;
            } else if (self.config.missingInfoErrorTemplate) {
                self.log('ERROR', debugMessage);
                out = self.template(self.config.missingInfoErrorTemplate);
            } else {
                out = "";
            }
        }
        return out;
    }
    finalizeResponse(response) {
        this._analyticsProperties._speaker = 'agent';
        return Promise.resolve()
            .then(() => {
                if (this.unsavedAttributes) {
                    return this.saveAttributes();
                }
                return Promise.resolve();
            })
            .then(() => {
                if (this.analytics) {
                    // return to wait for analytics
                    this.analytics.trackEvent(this, this.analyticsProperties());
                }
                return Promise.resolve();
            })
            .then(() => {
                return response;
            })
    }
    templateRespond(id, tempData, endSession = true, repromptId = null) {
        let out = this.templateResponse(id, tempData, endSession, repromptId);
        if (out === "") {
            throw({message: "empty template in templateRespond - check logs for missing replacements"});
        }
        return this.finalizeResponse(out.getResponse());
    }
    dialog(id, tempData = {}, endSession = false) {
        return this.templateRespond(id, tempData, endSession);
    }
    conditionalResponse(id, filterState, mergeState = {}, callback = null, endSession = false) {
        const self = this;
        if (filterState !== 'default' && !self.stateMatches(filterState, id)) {
            return false;
        }
        let updateState = Object.assign({"last-response-id": id}, mergeState);
        if (callback) {
            callback(self);
        }
        return this.setState(updateState)
            .then(() => {
                return self.dialog(id, {}, endSession)
            });
    }
    templateResponse(id, tempData, endSession = true, repromptId = null) {
        let speechText = this.template(id, tempData);
        this._analyticsProperties._message = speechText;
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
        let request = this.request(), slots;
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
        //let speechText = this.attributes && this.uiTemplates ? this.template(speech) : speech;
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
        return this.finalizeResponse(this.handlerInput.responseBuilder.getResponse());
    }
    respond(speechText, shouldEndSession = false, repromptText = null) {
        let out = this.response(speechText, shouldEndSession, repromptText);
        this._analyticsProperties._message = speechText;
        return this.finalizeResponse(out.getResponse());
    }
    response(speechText, endSession = false, repromptText = null) {
        let out = this.handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(endSession);
        this._analyticsProperties._message = speechText;
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
        this.unsavedAttributes = false;
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
        let can = typeMatches && nameCheck && this.canHandleFilter(handlerInput);
        return can;
    }
    static canHandleFilter(handlerInput) {
        return true;
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
        if ((!slot) || (slot.value === undefined)) {
            return null;
        }
        return slot.value;
    }
    allSlotValues() {
        const slotValues = {};
        const slots = this.slots();
        Object.keys(slots).forEach(key => {
            slotValues[key] = slots[key].value;
        });
        return slotValues;
    }
    allSlotIds() {
        const slotIds = {};
        const slots = this.slots();
        Object.keys(slots).forEach(key => {
            slotIds[key] = this.slotId(key);
        });
        return slotIds;
    }
    // process() {
    //     return this.respond(this.speechText());
    // }

    templateData(overrides) {
        //start with hard-coded templates;

        let data = this.config.uiTemplates;

        if (this.attributes !== undefined) {
            // then add uiTemplates (cms templates), factTemplates, factSet, userState
            if (typeof this.uiTemplates !== 'undefined') {
                Object.assign(data, this.uiTemplates);
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

    async loadDynamicConfig() {
        if (this.config.dynamicConfigTable) {
            const dynamicConfig = await this.config.db.get(
                `config_${this.skillId()}`,
                this.config.dynamicConfigTable
            )
            if (!dynamicConfig) {
                throw("dynamic config specified but could not be loaded")``
            }
            this.config = Object.assign(this.config, dynamicConfig.attributes);
        }
    }

    before() {
        return this.loadDynamicConfig()
            .then (() => {
                return this.loadAttributes()
            })
            .then(() => {
                return this.loadTemplates();
            })
            .then(() => {
                return this.loadState();
            })
            .then(() => {
                return this.saveAttributes();
            })
            .then(() => {
                if (this.analytics) {
                    this.analytics.trackEvent(this, this.analyticsProperties());
                }
                return Promise.resolve();
            })
            .then(() =>  {
                return Promise.resolve(this.beforeResponse());
            })
            .catch((error) => {
                return this.catchRespond(
                    `Sorry, I'm still setting a few things up. I should be ready in a couple of seconds. To try again, please say 'open ${this.config.invocationName}.'`,
                    error
                );
            });
    }

    analyticsProperties() {
        return this._analyticsProperties;
    }

    beforeResponse() {
        return null;
    }

    loadState() {
        if (Object.keys(this.getState()).length === 0) {
            this.replaceState(this.defaultState(), false);
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
        const canLoadFromCMS = this.config.airtableApiKey && this.config.airtableBaseId;

        if (this.templatesLoaded && (!force)) {
            return Promise.resolve();
        }
        this.config.uiTemplates['invocation-name'] = this.config.invocationName;
        this.config.uiTemplates['skill-name'] = this.config.skillName;

        this.templatesLoaded = true;

        if (!canLoadFromCMS) {
            return Promise.resolve();
        }

        return this.loadCachedUiTemplates()
            .then(result => {
                if (result) {
                    this.uiTemplates = result;
                    return Promise.resolve();
                } else {
                    return this.content.loadUiTemplates(this, this.isLaunchRequest())
                        .then(() => {
                            return this.storeCachedUiTemplates(this.uiTemplates);
                        })
                }
            })
            .then(_ => {
                this.uiTemplates["invocation-name"] = this.config.invocationName;
                this.uiTemplates["skill-name"] = this.config.skillName;
            })
            .catch((error) => {
                this.log('ERROR', error);
                return Promise.resolve();
            });
    }

    storeCachedUiTemplates(uiTemplates) {
        const self = this;
        self.config.cachedUiTemplates = uiTemplates;
        if (!self.config.userDb) {
            // older skill index.js does not provide the userDb instance in config
            return Promise.resolve();
        }
        const dbObject = {
            id: self.uiTemplateKey(),
            attributes: uiTemplates
        }
        const dbItem = self.config.dbConverter.marshall(dbObject);
        const dbParams = {
            TableName: self.config.userTableName,
            Item: dbItem
        };
        const request = self.config.userDb.putItem(dbParams);
        return request.promise()
            .then(result => {
                return Promise.resolve();
            })
            .catch(err => {
                return Promise.resolve();
            });
    }

    uiTemplateVersion() {
        const self = this;
        return self.config.uiTemplateVersion ? self.config.uiTemplateVersion : 1
    }

    uiTemplateKey() {
        const self = this;
        const version = self.uiTemplateVersion();
        const key = `_voicefirst.uiTemplates.v${version}`;
        return key;
    }

    loadCachedUiTemplates(skip = false) {
        const self = this;
        if (self.isLaunchRequest() && (self.config.isDev || (self.config.uiTemplatesRefreshPolicy === 'every-launch'))) {
            // reload every launch in dev
            return Promise.resolve(null);
        }
        if (self.config.cachedUiTemplates && (self.config.cachedUiTemplateVersion == self.uiTemplateVersion())) {
            // keep in-memory per lambda instance
            return Promise.resolve(self.config.cachedUiTemplates);
        }
        if (!self.config.userDb) {
            // older skill index.js does not provide the userDb instance in config
            return Promise.resolve();
        }
        const keyObject = {
            id: self.uiTemplateKey()
        };
        const dbKey = self.config.dbConverter.marshall(keyObject);
        const dbParams = {
            Key: dbKey,
            TableName: self.config.userTableName
        };
        const request = self.config.userDb.getItem(dbParams);
        return request.promise()
            .then(result => {
                if (!result.Item) {
                    return Promise.resolve();
                }
                const record = self.config.dbConverter.unmarshall(result.Item);
                self.config.cachedUiTemplates = record.attributes;
                self.config.cachedUiTemplateVersion = self.uiTemplateVersion();
                return Promise.resolve(self.config.cachedUiTemplates);
            })
            .catch(err => {
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

    setState(state, persist = true, saveNow = true, returnSync = false) {
        if (persist && saveNow && returnSync) {
            throw("Invalid state: can't return synchronously if we are saving persistent attributes now");
        }
        if (Object.keys(state).length === 0) {
            return Promise.resolve();
        }
        if (this.sessionId() && (persist !== 'only')) { //add to session for in-session requests - todo - maybe separate session
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
            } else {
                this.unsavedAttributes = true;
            }
        }
        if (returnSync) {
            return;
        }
        return Promise.resolve();
    }

    replaceState(state, saveNow = true) {
        this.attributesManager.setSessionAttributes(state);
        this.attributes.state = state;
        if (saveNow) {
            return this.saveAttributes();
        } else {
            this.unsavedAttributes = true;
            return Promise.resolve();
        }
    }
    getState(key = null) {
        let sessionAttributes;
        if (this.sessionId()) {
            //in-session
            sessionAttributes = this.attributesManager.getSessionAttributes() || {};
        } else {
            //out of session
            sessionAttributes = {};
        }

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

    static getSessionState(handlerInput, key = null) {
        if (!this.sessionId(handlerInput)) {
            //out of session request, no session attributes
            return null;
        }
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
        const state = sessionAttributes.state || {};
        if (!key) {
            return state;
        }
        return state[key];
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
        return BaseHandler.deviceId(this.handlerInput);
    }

    skillId() {
        return this.systemInput().application.applicationId;
    }

    static deviceId(input) {
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

    userId() {
        return this.userInput().userId;
    }

    sessionId() {
        return BaseHandler.sessionId(this.handlerInput);
    }

    static sessionId(handlerInput) {
        const session = handlerInput.requestEnvelope.session;
        if (!session) {
            return null;
        }
        return session.sessionId;
    }
    
    request() {
        return this.handlerInput.requestEnvelope.request;
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
        let request = this.request();
        if (!request.intent) {
            return null;
        }
        return request.intent.confirmationStatus;
    }

    arrayToSpeech(arr) {
        if (arr.length <= 2) {
            return arr.join(' and ');
        }
        const lastItem = arr.pop();
        return arr.join(', ') + `, and ${lastItem}`;
    }

    approximateInvocationPhrase() {
        return null;
    }

    process() {
        const self = this;
        return self.loadData()
            .then(() => {
                return self.renderUx();
            })
            .catch(error => {
                return self.catchRespond('error', error);
            })
    }
}
module.exports = BaseHandler;