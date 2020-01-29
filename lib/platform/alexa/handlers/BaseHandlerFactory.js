class BaseHandlerFactory {
    //handlerClass;
    constructor(config) {
        this.config = config;
    }
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const can = this.handlerClass.canHandle(handlerInput);
        const logInstance = new this.config.logger(handlerInput, this.config.logLevel);
        logInstance.log(can ? 'INFO' : 'DEBUG', 'ROUTING', `${this.handlerClass.name} ${can ? "CAN " : 'CANNOT'} HANDLE ${request.type} : ${request.intent ? request.intent.name : '[no name]'}`);
        return can;
    }
    handle(handlerInput) {
        const logInstance = new this.config.logger(handlerInput, this.config.logLevel);
        const handlerInstance = new (this.handlerClass)(handlerInput, this.config, logInstance);
        return handlerInstance.handle();
    }
}

module.exports = BaseHandlerFactory;