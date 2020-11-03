"use strict";

module.exports = class Base {
    constructor(logInstance) {
        this.logInstance = logInstance;
    }
    log() {
        this.logInstance.log.apply(this.logInstance, arguments);
    }
}