'use strict';

const winston = require('winston');

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      colorize: true,
      level: 'silly'
    }),
    new winston.transports.File({
      filename: 'host.log',
      level: 'verbose'
    })
  ]
});

module.exports = logger;
