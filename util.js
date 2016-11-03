'use strict';

const fs = require('fs');
const process = require('process');
const prettyBytes = require('pretty-bytes');

function copyFile(source, target) {
  return new Promise((resolve, reject) => {
    
    var rd = fs.createReadStream(source);
    rd.on('error', rejectCleanup);
    
    var wr = fs.createWriteStream(target);
    wr.on('error', rejectCleanup);
    
    function rejectCleanup(err) {
      rd.destroy();
      wr.end();
      reject(err);
    }
    
    wr.on('finish', resolve);
    rd.pipe(wr);
  });
}

exports.copyFile = copyFile;
exports.pb = prettyBytes;
exports.s = function(n, singular, plural) {
  if(singular === undefined) singular = '';
  if(plural === undefined) plural = 's';

  if(n === 1) return singular;
  return plural;
};

exports.mime = {
  'text/plain': 'text/plain',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/pjpeg': 'image/pjpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'image/tiff': 'image/tiff',
  'text/html': 'text/plain',
  'application/xhtml+xml': 'text/plain',
  'application/javascript': 'text/plain',
  'application/json': 'application/json',
  'application/pdf': 'application/pdf',
  'video/mpeg': 'video/mpeg',
  'video/mj2': 'video/mj2',
  'video/mp4': 'video/mp4',
  'video/ogg': 'video/ogg',
  'video/webm': 'video/webm',
  'video/quicktime': 'video/quicktime',
  'video/h261': 'video/h261',
  'video/h263': 'video/h263',
  'video/h264': 'video/h264'
};

exports.prod = process.env.NODE_ENV == 'production';
