'use strict'

const AWS = require('aws-sdk')

module.exports = class DynamoDb {
  constructor (config, useClient = null) {
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
    this.defaultTable = config.table
    this.client = useClient || new AWS.DynamoDB()
    this.converter = AWS.DynamoDB.Converter
  }

  async get (key, table = null) {
    const useTable = table || this.defaultTable
    const dbParams = {
      Key: this.converter.marshall({ id: key }),
      TableName: useTable
    }
    const request = this.client.getItem(dbParams)
    const result = await request.promise()
    if (!result.Item) {
      return null
    }
    const record = this.converter.unmarshall(result.Item)
    return record
  }

  async set (key, data, table = null) {
    const useTable = table || this.defaultTable
    try {
      const dbObject = {
        id: key,
        attributes: data
      }
      const dbItem = this.converter.marshall(dbObject)
      const dbParams = {
        TableName: useTable,
        Item: dbItem
      }
      const request = this.client.putItem(dbParams)
      const result = await request.promise()
      return result
    } catch (e) {
      console.log(e)
    }
  }

  async createStandardTable (tableName) {
    let out
    const request = this.client.createTable({
      TableName: tableName,
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH'
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    })
    const result = await request.promise()
    return result
  }
}
