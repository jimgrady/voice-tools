class ConsoleLogger {
    constructor(handlerInput) {
        try {
            let fullId = requestEnvelope.context.System.device.deviceId;
            this.deviceId = fullId.substring(-16);
        } catch(e) {
            this.deviceId = 'no-device-id';
        }
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
        if (!message) {
            return;
        }
        if (tagFilter.length > 0) {
            if (tags.filter(x => tagFilter.includes(x)).length === 0) {
                return;
            }
        }
        let fullMessage = `${level}: [${tags.join(',')}] ${this.deviceId}: ${message}`;
        if (level === 'ERROR') {
            console.error(fullMessage);
        } else {
            console.log(fullMessage);
        }
    }
};
module.exports = ConsoleLogger;