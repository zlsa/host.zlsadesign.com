'use strict';

const fs = require('fs-promise');
const http = require('http');
const process = require('process');
const path = require('path');
const querystring = require('querystring');

const shortid = require('shortid');
const merge = require('merge');
const hogan = require("hogan.js");

const HttpStatus = require('http-status-codes');
const express = require('express');
const compileSass = require('express-compile-sass');

const multer  = require('multer');

const storage = require('./storage.js');

const util = require('./util.js');
const log = require('./log.js');

class App {

  constructor(config) {
    
    this.config = merge({
      dir: {
        static: 'static',
        scss: 'style'
      },
      upload: {
        max_size: 50 * 1000 * 1000
      },
      storage: {
        max_cache: 300,
        meta: './meta.db',
        dir: path.join(process.cwd(), 'storage')
      },
      port: 6925
    }, config);

    this.initUploads();
    this.initStorage();
    this.initApp();
    this.initHttp();

    this.initTemplates();

    //this.storage.addTestFiles();
  }

  initUploads() {
    this.upload = multer({
      dest: 'uploads/'
    });
  }

  initStorage() {
    this.storage = new storage.Storage(this);
  }

  initApp() {
    this.app = express();

    this.app.get('/', (req, res) => {
      log.info(req.ip + ": /");
      res.sendFile(path.join(process.cwd(), this.config.dir.static, 'index.html'));
    });

    this.app.post('/upload', this.upload.array('files'), (req, res, next) => {
      this.addMulterFiles(req, res, req.files)
        .then((files) => {
          this.sendUploadedPage(req, res, files);
        });
    });


    this.initAppStyle();
    
    this.app.get('*', (req, res) => {
      let url = req.url.substring(1);
      
      let file_re = /^([a-zA-Z0-9\-\_]{7,14})(.([a-zA-Z0-9]{1,}))?$/g;
      
      if(url.match(file_re)) {
        log.silly("potential URL match: " + url);

        let result = file_re.exec(url);

        let id = result[1];
        let extension = result[3];

        this.sendFile(req, res, id);
      } else {
        this.sendErrorCode(req, res, 404);
      }
      
    });

  }

  addMulterFiles(req, res, files) {
    
    let promises = [];
    
    for(let file of files) {
      promises.push(this.addMulterFile(req, res, file));
    }

    return Promise.all(promises);
  }

  // file is in multer's format
  addMulterFile(req, res, info) {

    return new Promise((resolve, reject) => {

      if(info.originalname == 'index.html') {
        resolve({
          status: 'error',
          message: 'too index.html-like',
          info: info
        });
        return;
      }

      this.storage.addFile({
        upload_filename: info.originalname,
        upload_size: info.size,

        source: {
          path: path.join(__dirname, info.path),
          preserve: false
        },
        
        uploader: {
          ip: req.ip
        }
      })
        .then((file) => {
          log.info(req.ip + " uploaded a file: " + file.id + " ('" + file.name + "': " + util.pb(file.file.size) + ")");
          resolve({
            status: 'ok',
            file: file,
            info: info
          });
        })
        .catch((err) => {
          log.error(req.ip + " upload failed", err);
          resolve({
            status: 'error',
            info: info,
            message: err.message || 'unknown error'
          });
        });
    });
  }

  // initialize style processing
  initAppStyle() {
    let scss_path = path.join(this.config.dir.static, this.config.dir.scss);
    let root = path.join(process.cwd(), scss_path);

    this.app.use('/' + scss_path, compileSass({
      root: root,
      sourceMap: true,
      sourceComments: true,
      watchFiles: true,
      logToConsole: false
    }));
                 
    this.app.use('/static', express.static(this.config.dir.static));
  }

  initHttp() {
    this.http_server = http.createServer(this.app);
  }
  
  initTemplates() {
    this.templates = {};

    this.loadTemplate('error', 'error.html');
    this.loadTemplate('uploaded', 'uploaded.html');
  }

  loadTemplate(name, template) {
    template = path.join(__dirname, this.config.dir.static, template);
    
    let p = new Promise((resolve, reject) => {
      
      fs.readFile(template, 'utf8')
        .then((data) => {
          log.debug("compiling template '" + name + "' (from '" + template + "')");
          resolve(hogan.compile(data));
        })
        .catch((err) => {
          log.error("could not read template file '" + name + "' (from '" + path + "')", err);
          process.exit(1);
        });
      
    });

    this.templates[name] = p;
    
    return p;
  }

  sendFile(req, res, id) {
    
    this.storage.getFileById(id)
      .then((file) => {

        file.getBuffer()
          .then((buffer) => {

            let attach_type = 'attachment';

            let mime_type = file.file.mime_type;

            if(mime_type in util.mime) {
              mime_type = util.mime[mime_type];
              attach_type = 'inline';
            } else {
              mime_type = 'application/x-octet-stream';
            }
            
            log.info(id + ": sending '" + file.name + "' (" + mime_type + ") to " + req.ip);

            res.setHeader('Content-disposition', attach_type + '; filename="' + querystring.escape(file.name) + '"');
            res.set('Content-Type', mime_type);
            
            res.send(buffer);
          });
      })
      .catch((err) => {
        log.info(req.ip + " tried to view nonexistent file: " + id);
        this.sendErrorCode(req, res, 404);
      });
  }

  sendErrorCode(req, res, code) {
    res.status(404);

    if(req.accepts('html')) {
      this.templates.error.then((page) => {
        res.send(page.render({
          code: code,
          code_message: HttpStatus.getStatusText(code),
          message: 'there was an error.'
        }));
      });
    } else if(req.accepts('json')) {
      res.send({ error: 'Not found' });
    } else {
      res.type('txt').send('404 Not found');
    }
    
  }

  sendUploadedPage(req, res, files_list) {

    let files = [];

    for(let file of files_list) {
      
      let data = {
        name: file.info.originalname,
        status: file.status,
        size: file.info.size,
        url: null,
        message: file.message
      };

      if(data.status === 'ok') {
        data.url = file.file.getUrl();
        data.size = file.file.file.size;
        data.message = 'success';
      }

      files.push(data);
    }

    if(req.accepts('html')) {
      
      files = files.map((v) => {
        v.size = util.pb(v.size);
        return v;
      });

      this.templates.uploaded.then((page) => {
        res.send(page.render({
          number: files.length,
          number_plural: util.s(files.length),
          files: files
        }));
      });
      
    } else {
      
      res.send({status: 'ok', files: files});
    }
    
  }

  start() {
    return new Promise((resolve, reject) => {
      this.http_server.listen(this.config.port, "0.0.0.0", () => {
        resolve();
      });
    });
  }
  
}

exports.App = App;
