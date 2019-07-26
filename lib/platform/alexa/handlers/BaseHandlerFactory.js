class BaseHandlerFactory {
    constructor(config) {
        this.config = config;
        this.log = config.logger.log;
    }
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const can = this.handlerClass.canHandle(handlerInput);
        this.log(can ? 'INFO' : 'DEBUG', 'ROUTING', `${this.handlerClass.name} ${can ? "CAN " : 'CANNOT'} HANDLE ${request.type} : ${request.intent ? request.intent.name : '[no name]'}`);
        return can;
    }
    handle(handlerInput) {
        const handlerInstance = new (this.handlerClass)(handlerInput, this.config);
        return handlerInstance.handle();
    }
}

module.exports = BaseHandlerFactory;