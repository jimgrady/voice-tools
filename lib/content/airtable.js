class AirtableContent {
    constructor(config) {
        this.config = config;
        if (!(config.airtableApiKey && config.airtableBaseId)) {
            return; //TODO: logging
        }
        this.airtable().configure({apiKey: config.airtableApiKey});
        this.base = this.airtable().base(config.airtableBaseId);
        this.uiTable = config.airtableUiTable;
        this.uiView = config.airtableUiStringsView;
        if (this.config.isDev) {
            this.devPrefix = this.config.hasOwnProperty('airtableDevPrefix') ? this.config.airtableDevPrefix : 'Dev ';
        } else {
            this.devPrefix = '';
        }
    }

    static Airtable() {
        if (!this.AirtableModule) {
            this.AirtableModule = require('airtable');
        }
        return this.AirtableModule;
    }

    airtable() {
        return this.constructor.Airtable();
    }

    fetchTable(table, view, transform, filter, limit) {
        const self = this;
        return new Promise((resolve, reject) => {
            let allRecords = {};
            let options = {
                view: view
            };
            if (limit) {
                options.maxRecords = limit;
            }
            if (filter) {
                options.filterByFormula = filter;
            }
            self.base(this.devPrefix + table).select(options).eachPage(
                (records, fetchNextPage) => {
                    records.forEach((record) => {
                        let out = transform(record);
                        if (!Array.isArray(out)) {
                            out = [out];
                        }
                        out.forEach(subOut => {
                        if (subOut) {
                            allRecords[subOut['id']] = subOut['data'];
                        }
                        });
                    });
                    fetchNextPage();
                },
                (err) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                        return;
                    }
                    resolve(allRecords);
                }
            )
        });
    }



    loadTable(attributes, forceReload, key, table, view, transform, filter, limit) {
        if (typeof attributes[key] !== 'undefined' && !forceReload) {
            return Promise.resolve(attributes);
        }
        return this.fetchTable(table, view, transform, filter, limit)
            .then((records) => {
                attributes[key] = records;
                return Promise.resolve(attributes);
            })
            .catch(err => {
                console.log(err);
            })
    }

    loadFactSet(attributes, key, table, view, transform, id) {
        delete attributes[key];
        return this.loadTable(attributes, true, key, table, view, transform, `{Id} = ${id}`, 1)
            .then((attributes) => {
                if (typeof attributes[key] !== 'undefined') {
                    if (typeof attributes[key][id] === 'undefined') {
                        return Promise.reject('not found');
                    } else {
                        attributes[key] = attributes[key][id]
                    }
                }
                return Promise.resolve(attributes);
            });
    }

    loadUiTemplates(attributes, forceReload) {
        return this.loadTable(attributes, forceReload, 'uiTemplates', this.uiTable, this.uiView, (record) => {
            let out = [];
            if (record.get('Voice Content')) {
                out.push({id: record.get('Id'), data: record.get('Voice Content')});
            }
            if (record.get('Screen Title')) {
                out.push({id: `${record.get('Id')}-screen-title`, data: record.get('Screen Title')});
            }
            if (record.get('Screen Content')) {
                out.push({id: `${record.get('Id')}-screen-content`, data: record.get('Screen Content')});
            }
            return out;
        })
    }

    loadFactTemplates(attributes, forceReload) {
        return this.loadTable(attributes, forceReload, 'factTemplates', 'Questions', 'Grid view', (record) => {
            let out = {},
                id = record.get('Id'),
                template = record.get('Voice Content'),
                factDescription = record.get('Fact Description');
            if (!(id && template)) {
                return null;
            }
            out = {id: id, data: {template: template}};

            if (factDescription) {
                out.data.description = factDescription;
            }
            return out;
        });
    }

    fieldLabelToKey(fieldLabel) {
        return fieldLabel.toLowerCase().replace(/\s/g, '-');
    }

    template(key, data) {
        let string;
        if (typeof data[key] === 'undefined') {
            string = key;
        } else {
            string = data[key];
        }
        if (typeof string !== 'string') {
            return string;
        }
        const matchToKey = match => {
            return match.replace(/[{}]/g, '');
        };
        let matches = string.match(/{[^}]*}/g);
        if (!matches) {
            return string; //fixed string, no substitution placeholders
        }
        let anyMissingData = false;
        matches.forEach((match) => {
            let key = matchToKey(match);
            let keyParts = key.split(':');
            if ((typeof data[key] === 'undefined' || data[key] === null)
                && (keyParts.length !== 3 || typeof data[keyParts[0]] === 'undefined' || data[keyParts[0]] === null)) {
                console.log(`template ${string} missing data for ${key} `, data);
                anyMissingData = true;
                return;
            }
        });
        if (anyMissingData) {
            return null;
        }
        let replaced = string.replace(/\{[^\}]*\}/g, (match) => {
            let out;
            let key = matchToKey(match);

            let keyParts = key.split(':');
            if (keyParts.length === 3) { //e.g. hoa:true:Yes, there is an HOA
                let key = keyParts[0];
                let value = keyParts[1];
                if (data[key].toString() === value) {
                    out = keyParts[2];
                } else {
                    out = '';
                }
            } else {
                out = data[key];
            }
            return this.template(out, data);
        });
        return replaced;
    }
}

module.exports = AirtableContent;