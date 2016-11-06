'use strict';

const path = require('path');
const fs = require('fs-promise');

const mime = require('mime');
const shortid = require('shortid');

const util = require('./util.js');
const log = require('./log.js');

class File {

  constructor(app) {
    this.app = app;
    this.storage = app.storage;

    this.id = null;

    this.name = null;

    this.source = {
      path: null,
      preserve: false
    };

    this.time = {
      upload: 0,
      delete: 0
    };

    this.file = {
      path: null,
      mime_type: mime.default_type,
      size: -1
    };

    this.uploader = {
      ip: null
    };

    this.config = this.app.config.storage;
  }

  add(info) {
    
    this.name = info.upload_filename;

    this.file.mime_type = mime.lookup(info.upload_filename);
    this.file.size = info.upload_size;

    this.uploader.ip = info.uploader.ip;
    
    this.source.path = info.source.path;
    this.source.preserve = info.source.preserve;
    
    this.time.upload = Date.now();
    
    this.id = shortid.generate();

    if(this.file.size > this.app.config.upload.max_size) {

      return new Promise((resolve, reject) => {
        reject({
          status: 'error',
          message: 'file too large'
        });
      });
      
    }
    
    log.silly("adding new file '" + this.name + "'", info);
    log.silly("generated id for file '" + this.name + "': " + this.id);
      
    return this.copyFile(this)
      .then(this.readMetadata)
      .then(this.insertFile);
  }
  
  getUrl() {
    return '/' + this.id;
  }

  // Copies `source.path` to the storage location specified in
  // `app.config.storage.dir`, with a unique ID
  copyFile(file) {
    return new Promise((resolve, reject) => {
      
      file.file.path = path.join(file.config.dir, file.id);

      let from = file.source.path;
      let to = file.file.path;

      let preserve = file.source.preserve;

      let operation = null;

      if(preserve) {
        log.silly(file.id + ": copying temporary file '" + from + "' to '" + to + "' (original file will be preserved)");
        operation = util.copyFile(from, to);
      } else {
        log.silly(file.id + ": renaming temporary file '" + from + "' to '" + to + "'");
        operation = fs.rename(from, to);
      }

      operation
        .then(() => {
          log.silly(file.id + ": successfully copy/renamed '" + from + "' to '" + to + "'");
          resolve(file);
        })
        .catch((err) => {
          reject(err);
          log.warn(file.id + ": file copy/rename failed", err);
        });
      
    });
  }

  readMetadata(file) {
    return new Promise((resolve, reject) => {
      
      log.silly(file.id + ": reading storage file metadata '" + file.file.path + "'");
      
      fs.stat(file.file.path)
      
        .then((data) => {
          file.file.size = data.size;
          
          file.time.upload = Date.now();
          
          resolve(file);
        })
      
        .catch((err) => {
          log.warn(file.id + ": stat failed on storage file '" + file.file.path + "'", err);
          reject(err);
        });
      
    });
    
  }

  isVisible() {
    if(this.deleted) return false;
    return true;
  }

  getBuffer() {
    return new Promise((resolve, reject) => {

      fs.readFile(this.file.path)
        .then((buffer) => {
          this.buffer = buffer;
          resolve(buffer);
        })
        .catch((err) => {
          log.warn(this.id + ": could not read storage file '" + this.file.path + "'", err);
          reject(err);
        });
      
    });
  }

  setFromDocument(document) {
    
    this.id = document.id;
    this.name = document.name;
    
    this.time.upload = document.time.upload;
    this.time.delete = document.time.delete;
    
    this.deleted = document.deleted;

    this.file.path = path.join(this.config.dir, document.id);
    this.file.mime_type = document.info.mime_type;
    this.file.size = document.info.size;
    
    this.uploader = {
      ip: document.uploader.ip
    };
    
  }

  getDocument() {
    
    return {
      name: this.name,
      id: this.id,

      info: {
        mime_type: this.file.mime_type,
        size: this.file.size
      },

      time: {
        upload: this.time.upload,
        delete: this.time.delete
      },

      deleted: false,
      
      uploader: {
        ip: this.uploader.ip
      }
    };
    
  }

  insertFile(file) {
    return new Promise((resolve, reject) => {

      let document = file.getDocument.call(file);

      file.storage.db.insert(document)
      
        .then((data) => {
          log.silly(file.id + ": file metadata inserted into database");
          resolve(file);
        })
      
        .catch((err) => {
          log.warn(file.id + ": database insert failed", err);
          reject(err);
        });
      
    });
  }
}

exports.File = File;
