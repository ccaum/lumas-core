const EventEmitter = require("events").EventEmitter;
const util = require('util')
const logger = require('../logger.js').logger;
const Camera = require('../camera.js');
const retry = require('retry');
const Motion = require('motion-detect').Motion;
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');

module.exports = { constructor, ONVIF };

var motion = new Motion();

function constructor() {
  return ONVIF
}

function ONVIF(cameraName, config) {
  const self = this;

  this.name = cameraName;
  this.streamURL = config.rtsp;
  this.frame;

  self.processFeed();
  EventEmitter.call(self);
}

ONVIF.prototype.processFeed = function () {
  const self = this;
  let cap;

  var cameraOperation = retry.operation({ maxTimeout: 60 * 1000});

  cameraOperation.attempt( function() {
    cap = new cv.VideoCapture(self.streamURL);
  });

  const interval = setInterval(() => {
    let frame = cap.read();

    if (frame && !frame.empty) {
      this.frame = frame;

      if (motion.detect(frame)) {
        self.emit('frame', frame);
      }
    }
  }, 0);
}

ONVIF.prototype.getSnapshot = function(callback) {
  imencode('.jpg', this.frame);
}
