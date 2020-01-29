const RestClient = require('node-rest-client-promise');
const Base = require('./Base');

module.exports = class BaseApi extends Base {
    constructor(config, logInstance, accessToken) {
        super(logInstance);
        const self = this;
        self.requiresAuthorization = true;
        self.restClient = RestClient.Client({
            // proxy: {
            //     host: "localhost",
            //     port: 52764
            // }
        });
        self.config = config;
        self.accessToken = accessToken;
    }
    endpoint(path) {
        return `${this.baseUrl}/${path}`;
    }
    standardOptions() {
        let headers = this.defaultHeaders();
        this.addAuthHeader(headers);
        return {
            headers: headers,
            mimetypes: {
                json: ['application/json', 'application/json; charset=utf-8']
            }
        }
    }

    defaultHeaders() {
        return {
            "Content-Type": "application/json"
        };
    }

    addAuthHeader(headers) {
        if (this.requiresAuthorization) {
            headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return headers
    }

    defaultParams(method) {
        return null;
    }

    callApi(method, data) {
        const startDate = new Date();
        const startTime = startDate.getTime();
        const self = this;
        const endpoint = self.endpoint(self.path);
        let options = self.standardOptions();
        const dataProperty = method === 'get' ? 'parameters' : 'data';
        const defaults = self.defaultParams(method);
        if (defaults) {
            data = data || {};
            data = Object.assign(data, defaults);
        }
        if (data) {
            options[dataProperty] = data;
        }

        self.log('INFO', 'API', `calling ${endpoint}: ${method}: ${data === undefined ? 'no data sent' : JSON.stringify(data)}`)
        self.log('DEBUG', 'API', options);
        const url = endpoint + '?' + (data !== undefined ? Object.keys(data).map(key => key + '=' + data[key]).join('&') : '');
        return self.restClient[`${method}Promise`](
            endpoint,
            options
        )
            .then(result => {
                self.log('DEBUG', 'API', result.response.req._header);
                if (Buffer.isBuffer(result.data)) {
                    result.data = JSON.parse(result.data.toString());
                }
                self.log('DEBUG', `result: ${self.path}: ${method}: ${JSON.stringify(result.data)};`);
                if (result.response.statusCode >= 200 && result.response.statusCode <= 299) {
                    const elapsedTime = (new Date()).getTime() - startTime;
                    self.log('DEBUG', 'CALL_API_TIME', `${startDate.toISOString()}: ${self.path} took ${elapsedTime} milliseconds`);
                    return Promise.resolve(result.data);
                } else {
                    throw(`non-successful response status: ${result.response.statusCode}`);
                }
            })
            .catch(e => {
                self.log('ERROR', 'API', `${self.path}: ${method}: ${e}: ${data === undefined ? 'no data sent' : JSON.stringify(data)}`);
                return Promise.reject(e);
            });
    }

    get(data) {
        return this.callApi('get', data);
    }

    post(data) {
        return this.callApi('post', data);
    }

    put(data) {
        return this.callApi('put', data);
    }

    delete(data) {
        return this.callApi('delete', data);
    }
};