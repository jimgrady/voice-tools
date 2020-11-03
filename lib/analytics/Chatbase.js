"use strict";

module.exports = class ChatbaseAnalytics {
    constructor(config) {
        this.config = config;
        this.sdk = config.sdkClass;
        // this.sdk
        //     .setApiKey(config.apiKey) // Your Chatbase API Key
        //     .setPlatform('Alexa');
    }

    async trackEvent(params, caller) {
        // whatever the docs say, the following keys are actually required:
        // ['api_key', 'type', 'user_id',
        //   'time_stamp', 'platform', 'message']
        // and all must be strings, even the timestamp
        const self = this;
        const timestamp = Date.now();
        let message = self.sdk.newMessage(self.config.apiKey, params._userId)
            .setTimestamp(timestamp.toString())
            .setVersion('1.0')
            .setPlatform('Alexa');
        if (params._speaker === 'agent') {
            message.setAsTypeAgent();
        } else {
            message.setAsTypeUser();
        }

        if (params._intent) {
            message.setIntent(params._intent);
        }

        let messageText;
        if (params._message) {
            messageText = params._message;
        } else if (caller.approximateInvocationPhrase() === null) {
            messageText = params._intent;
        } else {
            messageText = caller.approximateInvocationPhrase();
        }

        message.setMessage(messageText);


        if (params._handled === false) {
            message.setAsNotHandled();
        } else {
            message.setAsHandled();
        }

        if (params._sessionId) {
            message.setCustomSessionId(params._sessionId);
        }

        let result;
        try {
            result = await message.send();
        } catch (e) {
            console.log(e);
        }
        console.log(result);
        return result;
        //.setAsFeedback() // sets the message as feedback from the user
        //    .setAsNotFeedback() // sets the message as a regular message -- this is the default
        //    .setCustomSessionId('123') // custom sessionId. A unique string used to define the scope of each individual interaction with bot.


    }
};