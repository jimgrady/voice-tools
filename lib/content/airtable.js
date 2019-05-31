const Airtable = require('airtable');
Airtable.configure({apiKey: process.env.AIRTABLE_API_KEY})
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const utils = require('../utils');

const fetchTable = (table, view, transform, filter, limit) => {
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
        base((utils.isDev ? 'Dev ' : '') + table).select(options).eachPage(
            (records, fetchNextPage) => {
                records.forEach((record) => {
                    let out = transform(record);
                    if (out) {
                        allRecords[out['id']] = out['data'];
                    }
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
};

const loadTable = (attributes, forceReload, key, table, view, transform, filter, limit) => {
    if (typeof attributes[key] !== 'undefined' && !forceReload) {
        return Promise.resolve(attributes);
    }
    return fetchTable(table, view, transform, filter, limit)
        .then((records) => {
            attributes[key] = records;
            return Promise.resolve(attributes);
        })
};

const loadFactSet = (attributes, key, table, view, transform, id) => {
    delete attributes[key];
    return loadTable(attributes, key, table, view, transform, `{Id} = ${id}`, 1)
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
};

const loadUiTemplates = (attributes, forceReload) => {
   return loadTable(attributes, forceReload, 'uiTemplates', 'UI Strings', 'Grid view', (record) => {
       if (!record.get('Template')) {
           return null;
       }
       return {id: record.get('Id'), data: record.get('Template')};
   })
};

const loadFactTemplates = (attributes) => {
    return loadTable(attributes, 'factTemplates', 'Questions', 'Grid view', (record) => {
        let out = {},
            id = record.get('Id'),
            template = record.get('Template'),
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
};

const fieldLabelToKey = (fieldLabel) => {
    return fieldLabel.toLowerCase().replace(/\s/g, '-');
};

const template = (key, data) => {
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
        return template(out, data);
    });
    return replaced;
};

module.exports = {
    fieldLabelToKey: fieldLabelToKey,
    loadUiTemplates: loadUiTemplates,
    loadFactTemplates: loadFactTemplates,
    loadFactSet: loadFactSet,
    template: template
};