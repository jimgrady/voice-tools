"use strict";

class ConsoleLogger {
    constructor(handlerInput, minLevel) {
        if (!minLevel) {
            minLevel = 'INFO';
        }
        try {
            let fullId = handlerInput.requestEnvelope.context.System.device.deviceId;
            this.deviceId = fullId.substr(fullId.length - 16);
        } catch(e) {
            this.deviceId = 'no-device-id';
        }
        const availableLevels = ['TRACE', 'DEBUG', 'NOTICE', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        this.levels = availableLevels.slice(availableLevels.indexOf(minLevel));
    }
    log() {
        let  tagFilter = [];
        let level = 'INFO';
        let tags = ['GENERAL'];
        let message = '';
        switch (arguments.length) {
            case 1:
                message = arguments[0];
                break
            case 2:
                tags = Array.isArray(arguments[0]) ? arguments[0] : [arguments[0]];
                message = arguments[1];
                break;
            case 3:
                level = arguments[0];
                tags = Array.isArray(arguments[1]) ? arguments[1] : [arguments[1]];
                message = arguments[2];
                break;
        }
        if (this.levels.indexOf(level) === -1) {
            return;
        }
        if (!message) {
            return;
        }
        if (tagFilter.length > 0) {
            if (tags.filter(x => tagFilter.includes(x)).length === 0) {
                return;
            }
        }
        // TODO: deal with circular
        // if (typeof message === 'object') {
        //     message = JSON.stringify(message);
        // }
        let fullMessage = `[${tags.join(',')}] ${this.deviceId}: ${message}`;
        switch (level) {
            case 'DEBUG':
                console.debug(fullMessage);
                break;
            case 'INFO':
                console.info(fullMessage);
                break;
            case 'WARN':
                console.warn(fullMessage);
                break;
            case 'ERROR':
                console.error(fullMessage);
                break;
            default:
                console.log(`${level}: ${fullMessage}`);
                break;
        }
    }
}
module.exports = ConsoleLogger;