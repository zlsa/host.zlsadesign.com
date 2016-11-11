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
const bodyParser = require('body-parser');

const multer  = require('multer');

const storage = require('./storage.js');

const util = require('./util.js');
const log = require('./log.js');

const auth = require('./auth.js');

class App {

  constructor(config) {
    
    this.config = merge({
      dir: {
        static: 'static'
      },
      auth: {
        default_privs: ['upload'],
        db: './users.db'
      },
      upload: {
        max_size: 30 * 1000 * 1000
      },
      storage: {
        max_cache: 300,
        db: './meta.db',
        dir: path.join(process.cwd(), 'storage')
      },
      port: 6925
    }, config);

    this.initUploads();
    this.initAuth();
    this.initStorage();
    this.initApp();
    this.initHttp();

    this.initTemplates();

    this.auth.getUserByName('admin')
      .catch(() => {
        this.auth.createAdminUser()
          .then((user) => {
            log.warn('generated admin user "' + user.id + '". This message is only shown once, so be sure to save the ID somewhere safe!');
          });
      });

    //this.storage.addTestFiles();
  }

  initUploads() {
    this.upload = multer({
      dest: 'uploads/'
    });
  }

  initAuth() {
    this.auth = new auth.Auth(this);
  }

  initStorage() {
    this.storage = new storage.Storage(this);
  }

  verifyUser(req, res) {
    
    return new Promise((resolve, reject) => {
      let id = req.body.user;

      if(!id) {
        log.warn(req.ip + " did not fill out their user id");
        this.sendErrorCode(req, res, 401, "you must enter your own user ID");
        reject();
      }

      this.auth.getUserById(id)
        .then((user) => {
          resolve(user);
        })
        .catch((err) => {
          log.warn("invalid user", err);
          this.sendErrorCode(req, res, 401);
          reject();
        });

    });

  }

  initApp() {
    this.app = express();

    this.app.use(bodyParser.urlencoded({
      extended: true
    }));
    
    this.app.enable('trust proxy');

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(process.cwd(), this.config.dir.static, 'index.html'));
    });
    
    this.app.get('/admin', (req, res) => {
      res.sendFile(path.join(process.cwd(), this.config.dir.static, 'admin.html'));
    });
    
    this.app.get('/users', (req, res) => {
      this.sendErrorCode(req, res, 401, "you are not an admin");
    });
    
    this.app.post('/users', (req, res) => {
      this.verifyUser(req, res)
        .then((user) => {
          
          if(!user.isAdmin()) {
            log.warn("unauthorized adduser attempt from " + user.id + ": " + req.ip);
            this.sendErrorCode(req, res, 401, "you are not an admin");
            return;
          }

          this.sendUsersPage(req, res);

        });
    });
    
    this.app.get('/add', (req, res) => {
      log.info(req.ip + " hit /add");
      res.sendFile(path.join(process.cwd(), this.config.dir.static, 'add.html'));
    });
    
    this.app.post('/add', (req, res) => {
      log.debug(req.ip + " has sent a request to add a user");

      this.verifyUser(req, res)
        .then((admin) => {
          
          if(!admin.isAdmin()) {
            log.warn("unauthorized adduser attempt from " + admin.id + ": " + req.ip);
            this.sendErrorCode(req, res, 401, "you are not an admin");
            return;
          }

          let name = req.body.name;
          let privs = req.body.privs;
          
          if(name.length === 0) {
            this.sendErrorCode(req, res, 400, "that username is too short");
            return;
          }

          if(!privs) {
            privs = this.config.auth.default_privs;
            log.debug("no privileges specified, using default", privs);
          } else {
            privs = privs.split(/,\s*/);
            log.debug("giving user-specified privileges", privs);
          }

          if(privs.length === 0) {
            this.sendErrorCode(req, res, 400, "you must enter at least one privilege");
            return;
          }

          for(let priv of privs) {
            if(!this.auth.isValidPriv(priv)) {
              this.sendErrorCode(req, res, 400, "invalid privilege: '" + priv + "'");
              log.warn(priv + " is not a valid privilege");
              return;
            }
          }

          this.auth.addUser({
            name: name,
            privs: privs
          })
            .then((user) => {
              log.info("added new user " + user.id + " (" + user.name + ") (authorized by " + admin.id + ", from " + req.ip + ")");
              
              if(req.body.showUsers) {
                res.redirect(307, '/users');
              } else {
                this.sendErrorCode(req, res, 200, "new user: " + user.id + " (" + user.name + ")");
              }
              
            })
            .catch((err) => {
              log.warn("could not add user", err);
              this.sendErrorCode(req, res, 500, "user add failed");
            });
          
        })
        .catch((err) => {
          log.warn("unauthorized adduser attempt from anonymous user: " + req.ip, err);
        });
      
    });

    this.app.get('/config.js', (req, res) => {
      res.set('Content-Type', 'application/javascript');
      res.send("var CONFIG = {upload: {max_size: " + this.config.upload.max_size + "}}");
    });

    this.app.get('/favicon.ico', (req, res) => {
      res.sendFile(path.join(process.cwd(), this.config.dir.static, 'images/favicon.ico'));
    });

    this.app.post('/upload', this.upload.array('files'), (req, res, next) => {

      let id = req.body.user;

      if(!id) {
        this.sendErrorCode(req, res, 401);
        return;
      }

      this.auth.getUserById(id)
        .then((user) => {
          
          if(!user.canUpload()) {
            log.warn("unauthorized upload attempt from " + user.id + ": " + req.ip);
            
            this.sendErrorCode(req, res, 401);

            return;
          }
          
          this.addMulterFiles(req, res, req.files, user)
            .then((files) => {
              this.sendUploadedPage(req, res, files);
            });
        })
        .catch((err) => {
          log.warn("unauthorized upload attempt from anonymous IP " + req.ip);

          this.sendErrorCode(req, res, 401);
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

  addMulterFiles(req, res, files, user) {
    
    let promises = [];
    
    for(let file of files) {
      promises.push(this.addMulterFile(req, res, file, user));
    }

    return Promise.all(promises);
  }

  // file is in multer's format
  addMulterFile(req, res, info, user) {

    return new Promise((resolve, reject) => {

      if(false) {
        resolve({
          status: 'error',
          info: info,
          message: 'ugh'
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
          log.info(user.id + " (" + user.name + ") uploaded a file: " + file.id + " ('" + file.name + "': " + util.pb(file.file.size) + ") from " + req.ip);
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
    this.app.use('/static', express.static(this.config.dir.static));
  }

  initHttp() {
    this.http_server = http.createServer(this.app);
  }
  
  initTemplates() {
    this.templates = {};

    this.loadTemplate('error', 'error.html');
    this.loadTemplate('uploaded', 'uploaded.html');
    this.loadTemplate('users', 'users.html');
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

        if(!file.isVisible()) {
          log.info(req.ip + " tried to view deleted file: " + id);
          this.sendErrorCode(req, res, 404);
          return;
        }

        file.getBuffer()
          .then((buffer) => {

            let attach_type = 'attachment';

            let mime_type = file.file.mime_type;

            if(mime_type in util.safe_mime) {
              mime_type = util.safe_mime[mime_type];
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

  sendErrorCode(req, res, code, message) {
    res.status(code);
    let string_code = HttpStatus.getStatusText(code);

    if(!message) message = '';

    if(req.accepts('html')) {
      this.templates.error.then((page) => {
        res.send(page.render({
          code: code,
          code_message: string_code,
          message: message
        }));
      });
    } else if(req.accepts('json')) {
      res.send({ error: string_code, message: message });
    } else {
      res.type('txt').send(code + ' ' + string_code + ' (' + message + ')');
    }
    
  }

  sendUsersPage(req, res, users) {

    this.auth.getAllUsers()
      .then((users) => {

        users.sort((a, b) => {
          if(a.time.create < b.time.create) return -1;
          else if(a.time.create > b.time.create) return 1;
          return 0;
        });

        let template_users = users.map((u) => {
          return {
            id: u.id,
            name: u.name,
            privs: u.privs.join(', ')
          };
        });

        log.info(req.ip + " hit /users");
        
        this.templates.users.then((page) => {
          res.send(page.render({
            users: users
          }));
        });
        
      });

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
        data.message = "uploaded";
      }

      files.push(data);
    }

    if(files.length == 1 && files[0].status === 'error') {
      res.status(400);
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
      res.json({status: 'ok', files: files});
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
