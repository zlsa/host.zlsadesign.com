'use strict';

const app = require('./app.js');

const log = require('./log.js');
const util = require('./util.js');

log.info("host.zlsadesign.com startup");

if(!util.prod) {
  log.warn("not in production mode; expect lots of logging");
}

var a = new app.App();

a.start()
  .then(() => {
    log.info("host.zlsadesign.com is running at port " + a.config.port);
  });
