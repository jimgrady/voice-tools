'use strict'

module.exports = {
  expressItemList: (items, punctuation) => {
    punctuation = punctuation || ','
    if (items.length <= 2) {
      return items.join(' and ')
    } else {
      return `${(items.slice(0, -1)).join(`${punctuation} `)}, and ${items[items.length - 1]}`
    }
  }

}
