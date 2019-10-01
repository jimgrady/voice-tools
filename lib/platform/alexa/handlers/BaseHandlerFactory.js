class BaseHandlerFactory {
    constructor(config) {
        this.config = config;
    }
    canHandle(handlerInput) {
        return this.handlerClass.canHandle(handlerInput);
    }
    handle(handlerInput) {
        const handlerInstance = new (this.handlerClass)(handlerInput, this.config);
        return handlerInstance.handle();
    }
}

module.exports = BaseHandlerFactory;