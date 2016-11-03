'use strict';

const nedb = require('nedb-promise');

const file = require('./file.js');
 
const log = require('./log.js');

class DB {

  constructor(app) {
    this.app = app;

    this.config = this.app.config.db;

    log.verbose("starting NeDB with file '" + this.config.meta + "'");
    
    this.db = nedb({
      filename: this.config.meta,
      autoload: true
    });

    this.addFile({
      // The original uploaded filename
      upload_filename: 'image.png',
      preserve: true,
      file_path: 'test/image.png',
      uploader: {
        ip: null
      }
    })
      .then((file) => {
        console.log('file!1!');
      })
      .catch((err) => {
        console.log(err);
      });
  }

  // Adds a file to the storage section
  addFile(info) {
    let f = new file.File(this.app);

    return f.add(info);
  }
  
}

exports.DB = DB;
