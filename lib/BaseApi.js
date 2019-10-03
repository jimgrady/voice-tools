const RestClient = require('node-rest-client-promise');
const Base = require('./Base');

module.exports = class BaseApi extends Base {
    constructor(config, logInstance, accessToken) {
        super(logInstance);
        const self = this;
        self.restClient = RestClient.Client({});
        self.config = config;
        self.accessToken = accessToken;
    }
    endpoint(path) {
        return `${this.baseUrl}/${path}`;
    }
    standardOptions() {
        return {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            mimetypes: {
                json: ['application/json', 'application/json; charset=utf-8']
            }
        }
    }

    callApi(method, data) {
        const self = this;
        const endpoint = self.endpoint(self.path);
        let options = self.standardOptions();
        const dataProperty = method === 'get' ? 'parameters' : 'data';
        if (data) {
            options[dataProperty] = data;
        }
        self.log('INFO', 'API', `calling ${self.path}: ${method}: ${data === undefined ? 'no data sent' : JSON.stringify(data)}`)
        return self.restClient[`${method}Promise`](
            endpoint,
            options
        )
        .then(result => {
            self.log('DEBUG', `result: ${self.path}: ${method}: ${JSON.stringify(result.data)};`);
            if (result.response.statusCode >= 200 && result.response.statusCode <= 299) {
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