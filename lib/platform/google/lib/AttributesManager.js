'use strict'

const admin = require('firebase-admin')

class AttributesManager {
  constructor (conv, config) {
    this.conv = conv
    this.config = config
    if (this.conv.user._id) {
      this.userId = this.conv.user._id
    } else {
      this.userId = 'dialogflow-test'
    }
    const serviceAccount = config.firebase_service_account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://<DATABASE_NAME>.firebaseio.com'
    })
    const db = admin.firestore()
    const usersRef = db.collection('users')
    this.userRef = usersRef.doc(this.userId)
  }

  setAttributes (attributes) {
    this.attributes = attributes
  }

  getAttributes () {
    return this.userRef.get()
    // .then(attributes => {
    //    attributes.timezone = 'America/New_York';
    //    return Promise.resolve(attributes);
    // });
  }

  saveAttributes (attributes) {
    return this.userRef.set(attributes)
  }
}

module.exports = AttributesManager
