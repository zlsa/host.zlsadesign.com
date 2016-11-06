'use strict';

const shortid = require('shortid');

const util = require('./util.js');
const log = require('./log.js');

class User {

  constructor(app) {
    this.app = app;
    this.auth = app.auth;

    this.id = null;

    this.name = null;

    this.privs = [];

    this.time = {
      create: 0,
      delete: 0
    };

    this.deleted = false;

    this.ips = {};

    this.config = this.app.config.auth;
  }

  add(info) {
    this.name = info.name;

    this.privs = info.privs;

    this.time.create = Date.now();
    
    this.id = shortid.generate();

    log.silly("generated id for user '" + this.name + "': " + this.id);
      
    return this.insertUser(this);
  }

  hasPriv(priv) {
    if(priv != '*' && this.hasPriv('*')) return true;
    return (this.privs.indexOf(priv) >= 0);
  }
  
  canUpload() {
    return this.hasPriv('upload');
  }
  
  isAdmin() {
    return this.hasPriv('admin');
  }
  
  setFromDocument(document) {
    
    this.id = document.id;
    this.name = document.name;

    this.time.create = document.time.create;
    this.time.delete = document.time.delete;

    this.privs = document.privs;
    
    this.deleted = document.deleted;

    this.ips = document.ips;
  }

  getDocument() {
    
    return {
      name: this.name,
      id: this.id,

      time: {
        create: this.time.create,
        delete: this.time.delete
      },

      privs: this.privs,

      deleted: false,
      
      ips: this.ips
    };
    
  }

  insertUser(user) {
    return new Promise((resolve, reject) => {

      let document = user.getDocument.call(user);

      user.auth.db.insert(document)
      
        .then((data) => {
          log.silly(user.id + ": user metadata inserted into database");
          resolve(user);
        })
      
        .catch((err) => {
          log.warn(user.id + ": database insert failed", err);
          reject(err);
        });
      
    });
  }
}

exports.User = User;
