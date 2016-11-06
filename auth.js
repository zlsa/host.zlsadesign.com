'use strict';

const nedb = require('nedb-promise');

const util = require('./util.js');
const log = require('./log.js');
const user = require('./user.js');

class Auth {

  constructor(app) {
    this.app = app;

    this.config = this.app.config.auth;

    log.verbose("starting auth NeDB with file '" + this.config.users + "'");
    
    this.db = nedb({
      filename: this.config.db,
      autoload: true
    });
  }

  isValidPriv(priv) {
    let valid = ['admin', 'upload'];
    if(valid.indexOf(priv) < 0) return false;
    return true;
  }

  addUser(info) {
    let u = new user.User(this.app);
    
    return u.add(info);
  }

  createAdminUser() {

    return this.addUser({
      name: 'admin',
      privs: ['*']
    });

  }

  getUserBySearch(search) {

    return new Promise((resolve, reject) => {

      this.db.findOne(search)
        .then((document) => {
          
          if(!document) {
            reject({
              error: 'no-document'
            });
          } else {
            let u = new user.User(this.app);
            u.setFromDocument(document);
            resolve(u);
          }
        }).catch((err) => {
          reject({
            error: 'no-document'
          });
        });
      
    });
  }

  getAllUsers() {

    return this.db.find({})
      .then((documents) => {

        let users = documents.map((doc) => {
          let u = new user.User(this.app);
          u.setFromDocument(doc);
          return u;
        });
        
        return users;
      });
    
  }

  getUserByName(name) {

    log.silly("fetching user by name: " + name);

    return this.getUserBySearch({
      name: name
    });
    
  }

  getUserById(id) {

    log.silly("fetching user by id: " + id);

    return this.getUserBySearch({
      id: id
    });
    
  }

}

exports.Auth = Auth;
