'use strict';

const app = require('./app.js');

const log = require('./log.js');

log.info("host.zlsadesign.com startup");

var a = new app.App();

a.start()
  .then(() => {
    log.info("host.zlsadesign.com is running at port " + a.config.port);
  });
