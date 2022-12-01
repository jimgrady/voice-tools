const Base = require('../Base')

module.exports = class ContentTools extends Base {
  maxRecursion = 100

  constructor (config) {
    super(config.logInstance)
    this.config = config
  }

  keyFromMatch (match) {
    return match.replace(/[{}]/g, '')
  }

  dataKeyFromCompoundKey (key) {
    return key.split(':')[0]
  }

  findTemplateTagMatches (content) {
    if (typeof content !== 'string') {
      return null
    }
    return content.match(/{[^}]*}/g)
  }

  isValidValue (value) {
    return !(value === null || value === undefined)
  }

  isAutomaticallyVaryingKey (key) {
    return key.charAt(key.length - 1) === '*'
  }

  selectKeyVariation (key, data, userHourOfDay) {
    const self = this
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
    const selectedVariationKey = variations[Math.floor(Math.random() * variations.length)]
    return selectedVariationKey
  }

  renderTemplateTag (match, data, userHourOfDay) {
    const self = this
    let out
    let key = self.keyFromMatch(match)
    if (self.isAutomaticallyVaryingKey(key)) {
      key = self.selectKeyVariation(key, data, userHourOfDay)
    }
    if (self.isCompoundTag(key)) {
      out = self.renderCompoundTag(key, data)
    } else {
      out = self.renderSimpleTag(key, data)
    }
    out = this.template(out, data, userHourOfDay, true)
    return out
  }

  renderCompoundTag (key, data) {
    // compound tag format: baseKey:condition:outputIfMatched:outputIfNotMatched
    const self = this
    let out
    const keyParts = key.split(/:/)
    if (keyParts.length < 3) {
      const error = { message: `invalid compound tag: ${key}` }
      throw error
    }
    const baseKey = keyParts[0]
    const baseValue = data[baseKey]

    const condition = keyParts[1]

    // only the special condition value 'any' is allowed to operate on null values,
    if (
      !(condition === 'any')
      && !self.isValidValue(baseValue)
    ) {
      // for all others, if the baseValue is null or undefined, return null
      return null
    }
    const outputIfMatched = keyParts[2]
    const outputIfNotMatched = keyParts.length === 4 ? keyParts[3] : ''

    let matched = false
    if (condition === '>0') {
      if (parseInt(baseValue) > 0) {
        matched = true
      }
    } else if (condition === '>0.0') {
      if (parseFloat(baseValue) > 0.0) {
        matched = true
      }
    } else if (condition.includes('!=')) {
      const compareTo = condition.split('!=')[1]
      if (baseValue !== compareTo) {
        matched = true
      }
    } else if (condition === 'any') {
      if (self.isValidValue(baseValue)) {
        matched = true
      }
    } else if (baseValue.toString() == condition) {
      matched = true
    } else if (condition === 'no' && baseValue === false || condition === 'yes' && baseValue === true) {
      matched = true
    } else {
      matched = false
    }
    out = matched ? outputIfMatched : outputIfNotMatched
    out = self.autoSingularOrPlural(out, baseValue)
    out = self.prepareInnerReplacements(out)
    return out
  }

  /*
  To simplify writing and parsing templates, we support square bracketed template tags inside a compound tag e.g.:
  {garage-yn:yes:This home has a [garage-type]}
  This function prepares them for interpretation as normal curly brace template tags in the next recursive render down
   */
  prepareInnerReplacements (input) {
    let out = input
    out = out.replaceAll('[', '{')
    out = out.replaceAll(']', '}')
    return out
  }

  autoSingularOrPlural (input, baseValue) {
    let out = input
    const pluralCharacter = baseValue == 1 ? '' : 's'
    const isAre = parseInt(baseValue) === 1 ? 'is' : 'are'
    out = out.replaceAll('[s]', pluralCharacter)
    out = out.replaceAll('[is]', isAre)
    return out
  }

  isCompoundTag (key) {
    // compound template tags are like a:b:c or a:b:c:d so they have at least two colons
    return (key.match(/:/g) || []).length >= 2
  }

  renderSimpleTag (key, data) {
    const out = data[key]
    return out
  }

  /*
There are 3 main ways the template function can be called
1. with a key referring to data in the data argument. So, template('mytemplate', {mytemplate: 'hello there'}
   we want to return 'hello there'
2. with literal text: template('hello yourself', {mytemplate: 'hello there'})
   in this case there is no key match in the data object so we want to return 'hello yourself'
3. recursively when there is a match to a key in curly braces like {mykey}
    So, a. template('outertemplate', {outertemplate: 'hello, {name}', name: 'Anne'} finds {name} and calls
            template again, with the same data argument, but with "name" as the key this time
        b. template('name', {outertemplate: 'hello, {name}', name: 'Anne'}
           and this returns the text 'Anne' back up to the outer template,
           which then returns 'hello, Anne.'
   If instead of a simple value 'Anne' the key name in the data object itself contained a template with {tags},
   then a third level of recursive call would be made and so on. The recursion depth limit is 100,
   to avoid accidental infinite loops.
 */
  template (key, data, userHourOfDay = null, recursionDepth = 0) {
    const self = this
    recursionDepth++
    if (recursionDepth > self.maxRecursion) {
      self.log('WARN', `Template max recursion reached, returning (depth ${recursionDepth})`)
    }

    // "content" is the content the template evaluates to
    // we default it to the value that was passed in, in case it is literal text without replacements
    let content = key

    // for top level calls (recursion depth 1) we want to grab the full template based on key
    // for recursive calls we don't want to substitute unless we have curly braces like {key}
    if ((recursionDepth === 1) && (typeof data[key] !== 'undefined')) {
      content = data[key]
    }

    // look for matches to template placeholder format {placeholder}
    const matches = self.findTemplateTagMatches(content)

    // if the content is not something we can or need to look for substituions in, just return it
    if (!matches) {
      return content
    }

    // we want the template system to correctly handle null or undefined,
    // meaning it will not attempt to render a template with missing data,
    // which would lead to undesired results.
    // it is expected that the calling code will return something like "I don't have enough information to answer that"
    // if it receives an empty string return value
    // if (self.anyMissingData(matches, data)) {
    //   return ''
    // }

    let anyMissingData = false
    const renderedContent = content.replace(/\{[^\}]*\}/g, (match) => {
      const matchOut = self.renderTemplateTag(match, data, userHourOfDay)
      if (!self.isValidValue(matchOut)) {
        anyMissingData = true
      }
      return matchOut
    })
    if (anyMissingData) {
      return ''
    }
    return renderedContent
  }
}
