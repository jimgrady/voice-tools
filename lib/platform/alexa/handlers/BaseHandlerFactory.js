class BaseHandlerFactory {
    constructor(config) {
        this.config = config;
    }
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const can = this.handlerClass.canHandle(handlerInput);
        const logInstance = new this.config.logger(handlerInput);
        logInstance.log(can ? 'INFO' : 'DEBUG', 'ROUTING', `${this.handlerClass.name} ${can ? "CAN " : 'CANNOT'} HANDLE ${request.type} : ${request.intent ? request.intent.name : '[no name]'}`);
        return can;
    }q
    handle(handlerInput) {
        const logInstance = new this.config.logger(handlerInput);
        const handlerInstance = new (this.handlerClass)(handlerInput, this.config, logInstance);
        return handlerInstance.handle();
    }
}

module.exports = BaseHandlerFactory;