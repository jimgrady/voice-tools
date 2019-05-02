const AWS = require('aws-sdk');
const utils = require('../utils');

if (utils.isDev) {
    AWS.config.update({
        region: "us-east-1",
        endpoint: "http://localhost:4000",
        credentials: {
            accessKeyId: 'local',
            secretAccessKey: 'local'
        }
    });
}

module.exports = AWS.DynamoDB;
