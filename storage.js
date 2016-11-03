'use strict';

const path = require('path');
const fs = require('fs');

const nedb = require('nedb-promise');

const file = require('./file.js');

const util = require('./util.js');
const log = require('./log.js');

class Storage {

  constructor(app) {
    this.app = app;

    this.config = this.app.config.storage;

    log.verbose("starting NeDB with file '" + this.config.meta + "'");
    
    this.db = nedb({
      filename: this.config.meta,
      autoload: true
    });

    this.file_cache = [];

    this.createStorageDirectory();
  }

  createStorageDirectory() {
    let dir = this.config.dir;
    
    if(!fs.existsSync(dir)) {
      log.info("first run? making directory '" + dir + "'");
      fs.mkdirSync(dir);
    }
  }

  clearCache() {
    log.debug("clearing " + this.file_cache.length + " cached file" + util.s(this.file_cache.length));
    
    this.file_cache = [];
  }

  addTestFiles() {
    this.addFile({
      // The original uploaded filename
      upload_filename: 'image.png',

      source: {
        path: 'test/image.png',
        preserve: true
      },
      
      uploader: {
        ip: null
      }
    })
      .then((file) => {
        let id = file.id;
        log.info("upload successful: " + file.id + " ('" + file.name + "': " + util.pb(file.file.size) + ")");
        this.clearCache();
        this.getFileById(file.id)
          .then((file) => {
          });
      })
      .catch((err) => {
        log.info("upload failed!");
      });
  }

  // handle file caching

  cacheFile(file) {
    this.file_cache.push(file);

    log.debug("added file to cache: total of " + this.file_cache.length + " cached file" + util.s(this.file_cache.length));
    
    if(this.file_cache.length > this.config.max_cache) {

      let num = 3;
      
      log.debug("emptying " + num + " files from the start of the cache");
      
      // arbitrarily remove a few of the first files; as long as this
      // is >= 1, we should be fine.
      
      this.file_cache.splice(0, num);
    }
  }

  getCachedFile(id) {
    if(!id) return null;
    
    for(let i in this.file_cache) {
      if(this.file_cache[i].id == id) return this.file_cache[i];
    }

    return null;
  }

  getFileById(id) {
    return new Promise((resolve, reject) => {
      let file = this.getCachedFile(id);

      if(file) {
        resolve(file);
        log.silly("used cached file " + id);
        return;
      }

      log.silly("fetching file " + id);
      
      this.db.findOne({
        id: id,
        deleted: false
      })
        .then((document) => {
          if(!document) {
            reject({
              error: 'no-document'
            });
          } else {
            
            this.addFileFromDocument(document)
              .then((file) => {
                resolve(file);
              });
            
          }
        });
      
    });
  }

  addFileFromDocument(document) {
    let f = new file.File(this.app);

    this.cacheFile(f);

    f.setFromDocument(document);

    return new Promise((resolve, reject) => {
      resolve(f);
    });
  }

  // Adds a file to the storage section
  addFile(info) {
    let f = new file.File(this.app);

    this.cacheFile(f);

    return f.add(info);
  }
  
}

exports.Storage = Storage;
