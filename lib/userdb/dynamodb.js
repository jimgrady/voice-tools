const AWS = require('aws-sdk')

module.exports = (config) => {
  if (config.dbType === 'local') {
    AWS.config.update({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000',
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
      }
    })
  }
  return AWS.DynamoDB
}
