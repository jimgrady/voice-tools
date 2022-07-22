'use strict'

class AirtableContent {
  constructor (config) {
    this.config = config
    if (!(config.airtableApiKey && config.airtableBaseId)) {
      return // TODO: logging
    }
    this.uiTable = config.airtableUiTable
    this.uiView = config.airtableUiStringsView
    if (this.config.isDev) {
      this.tablePrefix = this.config.hasOwnProperty('airtableDevPrefix') ? this.config.airtableDevPrefix : 'Dev '
    } else {
      this.tablePrefix = this.config.hasOwnProperty('airtableProdPrefix') ? this.config.airtableProdPrefix : ''
    }
  }

  base () {
    if (!this._base) {
      this._base = this.airtable().base(this.config.airtableBaseId)
    }
    return this._base
  }

  static Airtable () {
    if (!this.AirtableModule) {
      this.AirtableModule = require('airtable')
    }
    return this.AirtableModule
  }

  airtable () {
    if (!this._airtable) {
      this._airtable = this.constructor.Airtable()
      this._airtable.configure({ apiKey: this.config.airtableApiKey })
    }
    return this._airtable
  }

  fetchTable (table, view, transform, filter, limit) {
    const self = this
    return new Promise((resolve, reject) => {
      const allRecords = {}
      const options = {
        view: view
      }
      if (limit) {
        options.maxRecords = limit
      }
      if (filter) {
        options.filterByFormula = filter
      }
      self.base()(this.tablePrefix + table).select(options).eachPage(
        (records, fetchNextPage) => {
          records.forEach((record) => {
            let out = transform ? transform(record) : record
            if (!Array.isArray(out)) {
              out = [out]
            }
            out.forEach(subOut => {
              if (subOut) {
                allRecords[subOut.id] = subOut.data
              }
            })
          })
          fetchNextPage()
        },
        (err) => {
          if (err) {
            console.error(err)
            reject(err)
            return
          }
          resolve(allRecords)
        }
      )
    })
  }

  loadTable (attributes, forceReload, key, table, view, transform, filter, limit) {
    if (typeof attributes[key] !== 'undefined' && !forceReload) {
      return Promise.resolve(attributes)
    }
    return this.fetchTable(table, view, transform, filter, limit)
      .then((records) => {
        attributes[key] = records
        return Promise.resolve(attributes)
      })
      .catch(err => {
        console.log(err)
      })
  }

  loadFactSet (attributes, key, table, view, transform, id) {
    delete attributes[key]
    return this.loadTable(attributes, true, key, table, view, transform, `{Id} = ${id}`, 1)
      .then((attributes) => {
        if (typeof attributes[key] !== 'undefined') {
          if (typeof attributes[key][id] === 'undefined') {
            return Promise.reject('not found')
          } else {
            attributes[key] = attributes[key][id]
          }
        }
        return Promise.resolve(attributes)
      })
  }

  loadUiTemplates (attributes, forceReload) {
    return this.loadTable(attributes, forceReload, 'uiTemplates', this.uiTable, this.uiView, (record) => {
      const out = []
      if (record.get('Voice Content')) {
        out.push({ id: record.get('Id'), data: record.get('Voice Content') })
      }
      if (record.get('Screen Title')) {
        out.push({ id: `${record.get('Id')}-screen-title`, data: record.get('Screen Title') })
      }
      if (record.get('Screen Content')) {
        out.push({ id: `${record.get('Id')}-screen-content`, data: record.get('Screen Content') })
      }
      if (record.get('Start Hour')) {
        out.push({ id: `_hours:${record.get('Id')}`, data: `${record.get('Start Hour')}..${record.get('End Hour')}` })
      }
      return out
    })
  }

  loadFactTemplates (attributes, forceReload) {
    return this.loadTable(attributes, forceReload, 'factTemplates', 'Questions', 'Grid view', (record) => {
      let out = {}
      const id = record.get('Id')
      const template = record.get('Voice Content')
      const factDescription = record.get('Fact Description')
      if (!(id && template)) {
        return null
      }
      out = { id: id, data: { template: template } }

      if (factDescription) {
        out.data.description = factDescription
      }
      return out
    })
  }

  fieldLabelToKey (fieldLabel) {
    return fieldLabel.toLowerCase().replace(/\s/g, '-')
  }

  template (key, data, userHourOfDay = null) {
    let string
    if (typeof data[key] === 'undefined') {
      string = key
    } else {
      string = data[key]
    }
    if (typeof string !== 'string') {
      return string
    }
    const matchToKey = match => {
      return match.replace(/[{}]/g, '')
    }
    const matches = string.match(/{[^}]*}/g)
    if (!matches) {
      return string // fixed string, no substitution placeholders
    }
    let anyMissingData = false
    matches.forEach((match) => {
      const key = matchToKey(match)
      if (key.charAt(key.length - 1) !== '*') {
        const keyParts = key.split(':')
        if ((typeof data[key] === 'undefined' || data[key] === null) &&
                    (keyParts.length < 3 && (typeof data[keyParts[0]] === 'undefined' || data[keyParts[0]] === null))) {
          // console.log(`template ${string} missing data for ${key} `, data)
          anyMissingData = true
        }
      }
    })
    if (anyMissingData) {
      return ''
    }
    const replaced = string.replace(/\{[^\}]*\}/g, (match) => {
      let out
      let key = matchToKey(match)
      if (key.charAt(key.length - 1) === '*') { // ends in wildcard - support varying across all matches
        const keyBase = key.substring(0, key.length - 1) // key without *
        const variations = Object.keys(data).filter(k => {
          if (k.indexOf(keyBase) !== 0) {
            return false
          }
          const hours = data[`_hours:${k}`]
          if (hours && (!userHourOfDay)) {
            // we can't use a time-specific template like "good morning" if we don't know the user's timezone
            return false
          }
          if (!hours) {
            // not restricted by time of day
            return true
          }
          const hourParts = hours.split('..')
          const startHour = parseInt(hourParts[0])
          const endHour = parseInt(hourParts[1])
          if (startHour <= userHourOfDay && endHour >= userHourOfDay) {
            return true
          }
          return false
        })
        if (variations.length === 0) {
          throw ({ message: `no valid variations for varying template ${key}` })
        }
        key = variations[Math.floor(Math.random() * variations.length)]
      }

      const keyParts = key.split(':')
      if (keyParts.length >= 3) { // e.g. hoa:true:Yes, there is an HOA
        const key = keyParts[0]
        const value = keyParts[1]
        const outputIfMatched = keyParts[2]
        const outputIfNotMatched = keyParts.length === 4 ? keyParts[3] : ''
        let matched = false
        if (value === '>0') {
          if (data[key] === null) {
            return ''
          }
          if (parseInt(data[key]) > 0) {
            matched = true
          }
        } else if (value === '>0.0') {
          if (data[key] === null) {
            return ''
          }
          if (parseFloat(data[key]) > 0.0) {
            matched = true
          }
        } else if (value.includes('!=')) {
          const str = value.split('!=')[1]
          if (data[key] !== str) matched = true
        } else if (value === 'any' && data[key] && data[key] !== 'none') {
          matched = true
        } else if (data[key] && data[key].toString() == value) {
          matched = true
        } else {
          matched = false
        }
        out = matched ? outputIfMatched : outputIfNotMatched
        const pluralCharacter = data[key] == 1 ? '' : 's'
        const isAre = parseInt(data[key]) > 1 ? 'are' : 'is'
        out = out.replace('[s]', pluralCharacter)
        out = out.replace('[is]', isAre)
        out = out.replace('[', '{')
        out = out.replace(']', '}')
      } else {
        out = data[key]
      }
      out = this.template(out, data, userHourOfDay)
      return out
    })
    return replaced
  }
}

module.exports = AirtableContent
