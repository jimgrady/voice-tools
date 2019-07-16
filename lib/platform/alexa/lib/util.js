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
    console.log("CALL API", endpoint);
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

module.exports = {
    deviceId: deviceId,
    authInfo: authInfo,
    callApi: callApi
};