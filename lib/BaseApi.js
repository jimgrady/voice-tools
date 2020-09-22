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
        self.useCache = false;
        self.cacheExpirationSeconds = 3600;
    }
    endpoint(path) {
        const pathParamReplace = match => this.params[match];
        const pathWithParams = path.replace(/\{[a-z0-9_-]+\}/g, pathParamReplace)
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

    callApi(method, data, forceParameters) {
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
        if (forceParameters) {
            options.parameters = forceParameters;
        }

        const paramDebug = options.parameters ? '?' + Object.keys(options.parameters).map(key => key + '=' + options.parameters[key]).join('&') : '';
        self.log('INFO', 'API', `calling ${endpoint}${paramDebug}: ${method}: ${data === undefined ? 'no data sent' : JSON.stringify(data)}`);
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

    cacheKey(data) {
        return this.endpoint(this.path) + '?' + (data !== undefined ? Object.keys(data).map(key => key + '=' + data[key]).join('&') : '');
    }

    async getCache(params) {
        const self = this;
        if (!self.useCache) {
            return null;
        }
        const key = self.cacheKey(params);
        let result;
        try {
            result = await self.config.db.get(key);
        } catch(e) {
            return null;
        }
        if (result && result.attributes) {
            const cacheExpiration = result.attributes.expiresAt;
            if ((new Date()).getTime() >= cacheExpiration) {
                return null;
            }
            return self.decodeForCache(result.attributes.data);
        } else {
            return null;
        }
    }

    encodeForCache(data) {
        return JSON.stringify(data);
    }
    decodeForCache(cache) {
        return JSON.parse(cache);
    }

    async setCache(params, data) {
        const self = this;
        const saveResult = await this.config.db.set(
            self.cacheKey(params),
            {
                expiresAt: (new Date()).getTime() + (self.cacheExpirationSeconds * 1000),
                data: self.encodeForCache(data)
            }
        );
        return saveResult;
    }

    async get(data) {
        let out = await this.getCache(data);
        if (out) {
            return out;
        }
        out = await this.callApi('get', data);
        await this.setCache(data, out);
        return out;
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