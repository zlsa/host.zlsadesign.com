'use strict';

const winston = require('winston');
const util = require('./util.js');

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      colorize: true,
      level: (util.prod ? 'info' : 'silly')
    }),
    new winston.transports.File({
      filename: 'host.log',
      level: 'verbose'
    })
  ]
});

module.exports = logger;
