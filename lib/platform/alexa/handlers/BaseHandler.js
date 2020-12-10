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
        this.responseState = {};
        this.standardReprompt = this.config.standardReprompt || '';
        this.standardNextSteps = this.config.standardNextSteps || '';
        this.standardGoodbye = this.config.standardGoodbye || '';
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
    async after() {
        this._analyticsProperties._speaker = 'agent';
        if (this.unsavedAttributes) {
            await this.saveAttributes();
        }
        if (this.analytics && (!this.customAnalytics)) {
            // return to wait for analytics
            await this.analytics.trackEvent(this, this.analyticsProperties());
        }
    }
    templateRespond(id, tempData = {}, endSession = true, repromptId = null) {
        let out = this.templateResponse(id, tempData, endSession, repromptId);
        if (out === "") {
            throw({message: "empty template in templateRespond - check logs for missing replacements"});
        }
        this.setLastResponseId(id);
        return out.getResponse();
    }
    dialog(id, tempData = {}, endSession = false) {
        return this.templateRespond(id, tempData, endSession);
    }
    conditionalResponse(id, filterState, mergeState = null, callback = null, endSession = false, responseCallback = null) {
        const self = this;
        if (filterState !== 'default' && !self.stateMatches(filterState, id)) {
            return false;
        }
        if (callback) {
            callback(self);
        }
        if (mergeState && (Object.keys(mergeState).length > 0)) {
            this.setState(mergeState);
        }
        let out = this.templateResponse(id, {}, endSession, null);
        if (out === "") {
            throw({message: "empty template in templateRespond - check logs for missing replacements"});
        }
        if (responseCallback) {
            responseCallback(out);
        }
        this.setLastResponseId(id);
        return out.getResponse();
    }
    templateResponse(id, tempData, endSession = true, repromptId = null) {
        const self = this;
        this.handleFollowup(endSession);
        let speechText = this.template(id, tempData);
        this._analyticsProperties._message = speechText;
        let repromptText;
        if (!endSession) {
            speechText += self.standardNextSteps? ' ' + self.template(self.standardNextSteps, tempData) : '';
            if (repromptId) {
                repromptText = this.template(repromptId, tempData);
            } else if (this.standardReprompt) {
                repromptText = this.template(this.standardReprompt, tempData);
            }
        }
        return this.response(speechText, endSession, repromptText);
    }

    setLastResponseId(id) {
        this.setSessionState({"last-response-id": id});
        this._analyticsProperties['ResponseId'] = id;
    }
    /*
    Make sure that if we are not ending the session, appropriate next steps and/or reprompt are available
     */
    handleFollowup(endSession) {
        const self = this;
        if (endSession) {
            self.standardReprompt = null;
            self.standardNextSteps = '';
            self.standardGoodbye = self.generateStandardGoodbye();
            return;
        } else {
            self.standardNextSteps = self.generateStandardNextSteps();
            self.standardReprompt = self.generateStandardReprompt();
            self.standardGoodbye = '';
        }

    }

    generateStandardReprompt() {
        return this.standardReprompt;
    }

    generateStandardNextSteps() {
        return this.standardNextSteps;
    }

    generateStandardGoodbye() {
        return this.standardGoodbye;
    }

    slots() {
        let request = this.request(), slots;
        if (request && request.intent && request.intent.slots) {
            return request.intent.slots;
        } else {
            return {};
        }
    }

    slotId(slotName, dynamicOnly = false) {
        const slot = this.slots()[slotName];
        if (!(slot && slot.resolutions)) {
            return null;
        }
        for (const resolution of slot.resolutions.resolutionsPerAuthority) {
            if (resolution.status.code === 'ER_SUCCESS_MATCH'
                && ((!dynamicOnly) || (resolution.authority.indexOf('.dynamic.') !== -1))) {
                return resolution.values[0].value.id
            }
        }
        return null;
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
        return this.handlerInput.responseBuilder.getResponse();
    }
    delegateDialog(response = null, slots = {}) {
        if (!response) {
            response = this.handlerInput.responseBuilder;
        }
        return response
            .addDelegateDirective({
                "name": this.requestedIntentName(),
                "confirmationStatus": "NONE",
                "slots": slots
            });
    }

    async respond(speechText, shouldEndSession = false, repromptText = null) {
        const self = this;
        if (!speechText) {
            throw({"message": "cannot return an empty response"});
        }
        let out = this.response(speechText, shouldEndSession, repromptText);
        //this._analyticsProperties._message = speechText;
        self.log('DEBUG', 'RESPONSE_TEXT', speechText);
        return out.getResponse();
    }
    response(speechText, endSession = false, repromptText = null) {
        let out = this.handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(endSession);
        //this._analyticsProperties._message = speechText;
        self.log('DEBUG', 'RESPONSE_TEXT', speechText);
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
    async handle() {
        try {
            const input = await this.before();
            if (input && input.outputSpeech) {
                        //error during preprocessing generated a response already - don't call the handler instance process method
                        return input;
            }
            const out = await this.process();
            await this.after();
            return out;
        } catch(e) {
            if (process.env.ENV_TYPE === 'dev_skill') {
                this.log('ERROR', `${e.message}\nSTACK:${e.stack}`);
                process.exit();
            } else {
                throw(e);
            }
        }
    }

    static requestType() {
        return 'IntentRequest';
    }
    static canHandle(handlerInput) {
        const self = this;
        if (!handlerInput) {
            throw "Input not passed to canHandle";
        }
        let request = handlerInput.requestEnvelope.request;
        let requestType = self.requestType();
        if (!requestType) {
            throw("static requestType() must be defined in handler class " + self);
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
        const requestedIntent = self.requestedIntentName(handlerInput);
        if (requestedIntent) {
            nameCheck = false;
            let intentName = self.intentName();
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
        let can = typeMatches && nameCheck && self.canHandleFilter(handlerInput);
        return can;
    }

    requestedIntentName() {
        const self = this;
        return self.constructor.requestedIntentName(self.handlerInput);
    }

    static requestedIntentName(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        if (request.type !== 'IntentRequest') {
            return null;
        }
        return request.intent.name;
    }

    static canHandleFilter(handlerInput) {
        // rules for making sure a handlers that expect the same words only match in the right place.
        // mustFollowResponseId = {'IntentName1' => ['response-id-1', 'response-id-2']}
        // "ANY_INTENT" matches if no specific intent rule is defined
        // "ANY_RESPONSE" matches all
        const self = this;
        const rules = self.mustFollowResponseId();
        if (Object.keys(rules).length === 0) {
            return true;
        }
        let rule = rules[self.requestedIntentName(handlerInput)] || rules['ANY_INTENT'];
        if (!rule) {
            return true;
        }
        if (rule === 'ANY_RESPONSE') {
            return true;
        }
        const lastResponseId = self.lastResponseId(handlerInput);
        if (!lastResponseId) {
            return false;
        }
        return rule.indexOf(lastResponseId) !== -1;
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

        const state = this.getState() || {};
        data = Object.assign(data, state);

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
                // if (this.unsavedAttributes) {
                //     return this.saveAttributes();
                // } else {
                    return Promise.resolve();
                //}
            })
            .then(() => {
                if (this.analytics && (!this.customAnalytics)) {
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
            this.replaceUserState(this.defaultState());
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

    stateKey(forceMode = null) {
        const self = this;
        const mode = forceMode || this.config.defaultStateScope || 'user';
        if (mode === 'user' || mode === 'session') {
            return 'state';
        }
        const deviceId = self.deviceId();
        if (!deviceId) {
            throw({"message": "cannot set device-level state in a non-device request"});
        }
        return `state_${deviceId}`;
    }

    setAttributes(attributes) {
        const self = this;
        self.unsavedAttributes = true;
        Object.assign(self.attributes, attributes);
    }

    setUserState(state, options = {}) {
        const {persist = 'only'} = options;
        return this.setState(state, persist, false, true, 'user');
    }

    setDeviceState(state, options = {}) {
        const {persist = 'only'} = options;
        return this.setState(state, persist, false, true, 'device');
    }

    setSessionState(state) {
        return this.setState(state, false, false, true, 'session');
    }

    setResponseState(state) {
        return this.setState(state, false, false, true, 'response');
    }

    moveUserStateToDeviceState(key) {
        const self = this;
        self.attributes[self.stateKey('device')] = self.attributes[self.stateKey('device')] || {};
        self.attributes[self.stateKey('device')][key] = self.attributes[self.stateKey('user')][key];
        delete self.attributes[self.stateKey('user')][key];
        self.unsavedAttributes = true;
    }

    setState(state, persist = true, saveNow = null, returnSync = false, scope = null) {
        const self = this;
        if (scope === 'response') {
            Object.assign(this.responseState, state);
            return;
        }
        if (saveNow === null) {
            if (self.config.defaultSaveStateImmediate === false) {
                saveNow = null;
                returnSync = true;
            }
        }
        if (scope === null) {
            const userState = self.attributes[self.stateKey('user')] || {};
            scope = userState['default-state-scope'] || 'user';
        }
        if (persist && saveNow && returnSync) {
            throw("Invalid state: can't return synchronously if we are saving persistent attributes now");
        }
        if (Object.keys(state).length === 0) {
            return Promise.resolve();
        }
        if (this.sessionId() && (persist !== 'only')) { //add to session for in-session requests - todo - maybe separate session
            let sessionAttributes = this.attributesManager.getSessionAttributes();
            if (!sessionAttributes[self.stateKey('session')]) {
                sessionAttributes[self.stateKey('session')] = {};
            }
            Object.assign(sessionAttributes[self.stateKey('session')], state);
            this.attributesManager.setSessionAttributes(sessionAttributes);
        }
        if (persist) {
            if (!this.attributes[self.stateKey(scope)]) {
                this.attributes[self.stateKey(scope)] = {};
            }
            Object.assign(this.attributes[self.stateKey(scope)], state);
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

    unsetState(scope) {
        const self = this;
        switch (scope) {
            case 'response':
                self.responseState = {};
                return;
            case 'session':
                const sessionAttributes = self.attributesManager.getSessionAttributes() || {};
                delete sessionAttributes[self.stateKey('session')];
                self.attributesManager.setSessionAttributes(sessionAttributes);
                return;
            case 'device':
                delete self.attributes[self.stateKey('device')];
            case 'user':
                delete self.attributes[self.stateKey('user')];
        }
        self.unsavedAttributes = true;
    }

    replaceUserState(state) {
        const self = this;
        this.attributes = this.attributes || {};
        this.attributes[self.stateKey('user')] = state;
        this.unsavedAttributes = true;
    }
    getState(key = null) {
        const self = this;
        let sessionAttributes;
        if (this.sessionId()) {
            //in-session
            sessionAttributes = this.attributesManager.getSessionAttributes() || {};
        } else {
            //out of session
            sessionAttributes = {};
        }

        // state storage in order of priority
        const responseState = self.responseState;
        const sessionState = sessionAttributes[self.stateKey('session')] || {};
        const deviceState = self.attributes[self.stateKey('device')] || {};
        const userState = self.attributes[self.stateKey('user')] || {};

        if (!key) {
            // no key specified - merge and return entire state object
            let out = {};
            if (userState) {
                out = Object.assign({}, userState);
            }
            if (deviceState) {
                out = Object.assign(out, deviceState);
            }
            if (sessionState) {
                out = Object.assign(out, sessionState);
            }
            if (responseState) {
                out = Object.assign(out, responseState);
            }
            return out;
        }

        // key was specified - return first value found from priority order
        if (responseState.hasOwnProperty(key)) {
            return responseState[key];
        }
        if (sessionState.hasOwnProperty(key)) {
            return sessionState[key];
        }
        if (deviceState.hasOwnProperty(key)) {
            return deviceState[key];
        }
        if (userState.hasOwnProperty(key)) {
            return userState[key];
        }
        return null;
    }

    static getSessionState(handlerInput, key = null) {
        const self = this;
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

    requestId() {
        return this.request().requestId;
    }

    locale() {
        return this.request().locale || 'en-US';
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
        const self = this;
        //this.accessToken = 'ya29.GlyIB-QA-3YMtARcYghXbGZPnqclYpYK8z7TW0BpfylNCWTdAfIXDy-S3daq7pI5pX_oipocxBjeONuUQGNKpATcABXOF1tNSlchGmT3u2cwJEEziB2sQ1uR-ZPUdA';
        if (this.config.hasOwnProperty('testAccessToken')) {
            this.accessToken = this.config.testAccessToken;
            this.attributes[self.stateKey()]['account-linked'] = !!this.accessToken;
            return;
        }
        try {
            // noinspection JSUnresolvedVariable
            let accessToken = this.userInput().accessToken;
            if (accessToken) {
                this.attributes[self.stateKey()]['account-linked'] = true;
                this.accessToken = accessToken;
            } else {
                this.attributes[self.stateKey()]['account-linked'] = false;
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

    arrayToSpeech(arr, conjunction = 'and') {
        if (arr.length <= 2) {
            return arr.join(` ${conjunction} `);
        }
        const lastItem = arr.pop();
        return arr.join(', ') + `, and ${lastItem}`;
    }

    approximateInvocationPhrase() {
        return null;
    }

    async loadData() {
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

    delegateRespond() {
        const self = this;
        return self.handlerInput.responseBuilder
            .addDelegateDirective()
            .getResponse();
    }

    static lastResponseId(handlerInput) {
        const self = this;
        const sessionState = self.getSessionState(handlerInput);
        if (sessionState) {
            return sessionState['last-response-id'] || null;
        } else {
            return null;
        }
    }

    static mustFollowResponseId() {
        return {};
        // TODO: also add response id must be in path
    }

    applyLexicon(text) {
        if (!text) {
            return text;
        }
        if (!this.config.lexicon) {
            return text;
        }
        for (const lex of this.config.lexicon) {
            text = text.replace(lex.pattern, lex.replacement);
        }
        return text;
    }
}
module.exports = BaseHandler;