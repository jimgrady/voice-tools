module.exports = class AmplitudeAnalytics {
    constructor(config) {
        this.config = config;
        this.sdk = new config.sdkClass(config.apiKey);
    }

    trackEvent(params) {
        const data = {
            event_type: params._intent, // required
            user_id: params._userId, // only required if device id is not passed in
            device_id: params._deviceId, // only required if user id is not passed in
            //session_id: 1492789357923, // must be unix timestamp in ms, not required
            event_properties: params,
            // user_properties: {
            //     //...
            // }
        }
        delete data.event_properties._intent;
        delete data.event_properties._userId;
        delete data.event_properties._deviceId;
        this.sdk.track(data);
    }

};