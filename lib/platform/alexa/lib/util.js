const restClient = require('node-rest-client-promise').Client();

const deviceId = (input) => {
    return input.requestEnvelope.context.System.device.deviceId;
};

const authInfo = (input) => {
    const system = input.requestEnvelope.context.System;
    return {
        apiEndpoint: system.apiEndpoint,
        deviceId: deviceId(input),
        apiAccessToken: system.apiAccessToken
    }
};

const callApi = (version, path, input) => {
    const auth = authInfo(input);
    const endpoint = `${auth.apiEndpoint}/${version}/devices/${auth.deviceId}/${path}`;
    return restClient.getPromise(
        endpoint,
        {
            headers: {
                Authorization: `Bearer ${auth.apiAccessToken}`
            },
            mimetypes: {
                json: ['application/json', 'application/json; charset=utf-8']
            }
        }
    );
};

const getTimezone = (handlerInput) => {
    const auth = authInfo(handlerInput);
    const restClient = require('node-rest-client-promise').Client();
    return restClient.getPromise(
        `${auth.apiEndpoint}/v2/devices/${auth.deviceId}/settings/System.timeZone`,
        {
            headers: {
                Authorization: `Bearer ${auth.apiAccessToken}`
            }
        })
            .then(result => {
                return Promise.resolve(result.data);
            });
};

const getDistanceUnit = (handlerInput) => {
    const auth = authInfo(handlerInput);
    const restClient = require('node-rest-client-promise').Client();
    return restClient.getPromise(
        `${auth.apiEndpoint}/v2/devices/${auth.deviceId}/settings/System.distanceUnits`,
        {
            headers: {
                Authorization: `Bearer ${auth.apiAccessToken}`
            }
        })
        .then(result => {
            return Promise.resolve(result.data);
        });
};

const getEmail = (handlerInput) => {
    const auth = authInfo(handlerInput);
    const restClient = require('node-rest-client-promise').Client();
    return restClient.getPromise(
        `${auth.apiEndpoint}/v2/accounts/~current/settings/Profile.email`,
        {
            headers: {
                Authorization: `Bearer ${auth.apiAccessToken}`
            }
        })
        .then(result => {
            if (result.response.statusCode === 403) {
                return Promise.reject("permission denied");
            }
            return Promise.resolve(result.data);
        });
};

///v2/accounts/~current/settings/Profile.email

module.exports = {
    deviceId: deviceId,
    authInfo: authInfo,
    callApi: callApi,
    getTimezone: getTimezone,
    getEmail: getEmail,
    getDistanceUnit: getDistanceUnit
};