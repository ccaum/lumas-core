const EventEmitter = require("events").EventEmitter;
const util = require('util')
const logger = require('../logger.js').logger;
const Camera = require('../camera.js');
const retry = require('retry');
const Motion = require('motion-detect').Motion;
const spawn = require('child_process').spawn;
const ffmpeg = require('fluent-ffmpeg');
const memfs = require('memfs');
const fs = require('fs');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');

module.exports = { constructor, ONVIF};

var motion = new Motion();

function constructor() {
  return ONVIF
}

function ONVIF(cameraName, config) {
  const self = this;
  this.name = cameraName;
  this.streamURL = config.rtsp;
  this.frame;
  this.frameDirectory = '/cameras/' + "test";

  if (!fs.existsSync('/cameras/')) fs.mkdirSync('/cameras/');
  if (!fs.existsSync('/cameras/' + 'test')) fs.mkdirSync('/cameras/' + 'test');

  this.auth = {
    user: config.username,
    pass: config.password,
  }

  this.processFeed();
  EventEmitter.call(self);
}

util.inherits(ONVIF, Camera);

ONVIF.prototype.processFrame = function (frame) {
  const self = this;
  logger.log('debug', "Processing frame " + frame);
  var file = this.frameDirectory + "/frame" + frame + ".jpg";

  fs.readFile(file, function(err, buf) {
    if (err) {
      logger.log('error', "Could not read frame file: " + err.message);
    }

    self.emit('frame', buf);
  });

  fs.unlink(file, function(err) {
    if (err) {
      logger.log('error', "Could not delete frame file " + file);
    }
  });
}

ONVIF.prototype.processFeed = function () {
  const self = this;
  var cameraOperation = retry.operation({ maxTimeout: 60 * 1000});
  var lastFrameEnqueued = 0;

  let ffmpegsh = spawn('ffmpeg', ['-i', self.streamURL, '-rtsp_transport', 'tcp', '-map', '0:0', '-f', 'image2', self.frameDirectory + '/frame%d.jpg'])
  ffmpegsh.stdout.on('data', function(out) {
    console.log('stdout');
    console.log(out.toString('utf8'));
  });
  ffmpegsh.stderr.on('data', function(out) {
    stderrString = out.toString('utf8')
    let digit = 0
    let regex = /^(frame)=\s+\d+\s/
    let found = stderrString.match(regex)
    if (found) {
      string = found[0]
      string = string.split(' ')
      digit = string[string.length-2]


      self.processFrame(digit)
    }
  });
  ffmpegsh.on('exit', function() {
    console.log('ffmpeg closed');
  });
}

ONVIF.prototype.getSnapshot = function(callback) {
  const file = this.frameDirectory + '/' + snapshot.jpg;

  fs.readFile(file, function(err, buf) {
    if (err) {
      logger.log("error", "Could not read " + file + " from fs: " + err.message);
    }

    callback(buf);
  });
}
