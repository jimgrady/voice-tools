const restClient = require('node-rest-client-promise').Client();

const authInfo = (input) => {
    const system = input.requestEnvelope.context.System;
    return {
        apiEndpoint: system.apiEndpoint,
        deviceId: system.device.deviceId,
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
    authInfo: authInfo,
    callApi: callApi
};