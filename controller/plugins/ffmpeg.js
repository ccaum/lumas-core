const EventEmitter = require("events").EventEmitter;
const util = require('util')
const logger = require('../logger.js').logger;
const Camera = require('../camera.js');
const retry = require('retry');
const Motion = require('motion-detect').Motion;
const spawn = require('child_process').spawn;
const ffmpeg = require('fluent-ffmpeg');
const memfs = require('memfs');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');

module.exports = { constructor, FFMPEG};

var motion = new Motion();

function constructor() {
  return FFMPEG
}

function FFMPEG(cameraName, config) {
  const self = this;
  this.name = cameraName;
  this.streamURL = config.rtsp;
  this.frame;

  this.auth = {
    user: config.username,
    pass: config.password,
  }

  this.processFeed();
  EventEmitter.call(self);
}

util.inherits(FFMPEG, Camera);

FFMPEG.prototype.processFeed = function () {
  const self = this;
  var frameFile = memfs.createWriteStream('/frame.jpg');
  var cameraOperation = retry.operation({ maxTimeout: 60 * 1000});

  console.log('emitting');
  self.emit('frame', 'hi');
  cameraOperation.attempt( function() {
    let ffmpegCommand = ['-y', '-i', self.streamURL,
      '-rtsp_transport', 'tcp',
      '-err_detect','ignore_err',
      '-map', '0:0',
      '-f', 'image2',
      '-updatefirst','1',
      '/frame.jpg']

      let ffmpeg = spawn('ffmpeg', ffmpegCommand, {env: process.env});

      ffmpeg.on('error', function(err) {
        logger.log("error", "Got error from FFMPEG: " + err);
      });

      ffmpeg.on('close', (code) => {
        if(code == null || code == 0 || code == 255){
          logger.log("info", "Stopped streaming");
        } else {
          logger.log("error", "ERROR: FFmpeg exited with code " + code);
        }
      });
  });

  const interval = setInterval(() => {
    memfs.readFile("/frame.jpg", "utf8", function(err, data) {
      if (err) {
        logger.log("error", "Could not read " + "/frame.jpg from memfs: " + err.message);
      }

      this.frame = data;
      this.emit('frame', data);
    }.bind(self));
  }, 0);
}

FFMPEG.prototype.getSnapshot = function(callback) {
  const file = "/frame.jpg"

  memfs.readFile(file, function(err, buf) {
    if (err) {
      logger.log("error", "Could not read " + file + " from memfs: " + err.message);
    }

    callback(buf);
  });
}
