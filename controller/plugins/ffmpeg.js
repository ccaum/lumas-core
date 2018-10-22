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
  this.frameDirectory = '/cameras/' + "test/";

  memfs.mkdirSync('/cameras/');
  memfs.mkdirSync('/cameras/' + 'test');

  this.auth = {
    user: config.username,
    pass: config.password,
  }

  this.processFeed();
  EventEmitter.call(self);
}

util.inherits(FFMPEG, Camera);

FFMPEG.prototype.processFrame = function (frame) {
  var file = this.frameDirectory + "/frame" + frame + ".jpg";

  memfs.readFile(file, function(err, buf) {
    if (err) {
      logger.log('error', "Could not read frame file: " + err.message);
    }

    this.emit('frame', buf);
  });

  memfs.rm(file);
}

FFMPEG.prototype.processFeed = function () {
  const self = this;
  var cameraOperation = retry.operation({ maxTimeout: 60 * 1000});
  var lastFrameEnqueued = 0;

  ffmpeg(self.streamURL)
  .outputOptions(['-rtsp_transport tcp', '-map 0:0', '-f image2'])
  .on('start', function(commandLine) {
    logger.log('debug', "Running ffmpeg with command: " + commandLine)
  })
  .on('progress', function(progress) {
    var n = lastFrameEnqueued + 1;
    lastFrameEnqueued = progress.frames - 1;

    for (; n < progress.frames; n++) {
      processFrame(n);
    }
  })
  .on('stderr', function(err) {
    logger.log('error', err);
  })
  .save(self.frameDirectory + '/frame%d.jpg')
  //.save(self.frameDirectory + '/snapshot.jpg')
}

FFMPEG.prototype.getSnapshot = function(callback) {
  const file = this.frameDirectory + '/' + snapshot.jpg;

  memfs.readFile(file, function(err, buf) {
    if (err) {
      logger.log("error", "Could not read " + file + " from memfs: " + err.message);
    }

    callback(buf);
  });
}
