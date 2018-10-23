const EventEmitter = require("events").EventEmitter;
const request = require('request');
const http = require('http');
const util = require('util')
const memfs = require('memfs');
const fs = require('fs');
const logger = require('./logger.js').logger;
const retry = require('retry');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');
const Agent = require('agentkeepalive');

module.exports = Camera;

function Camera(config, controllerEvents) {
  const self = this;
  this.name = config.name;

  pluginConfig = config.plugin;
  plugin = require('./plugins/' + pluginConfig.name + '.js');
  constructor = plugin.constructor();
  this.cameraPlugin = new constructor(config.name, pluginConfig.config);
  this.cameraPlugin.on('frame', function(data) {
    self.emit('frame', data);
  });

  if (controllerEvents) {
    controllerEvents.on('classifiedImg', function(imgBuf) {
      logger.log('debug', "Caching annotated snapshot");
      memfs.writeFile('/annotatedSnapshot.jpg', imgBuf, function() {});
    });
  }

  EventEmitter.call(self);
}

util.inherits(Camera, EventEmitter);

Camera.prototype.getSnapshot = function (callback) {
  const self = this;
  const file = "/annotatedSnapshot.jpg"

  memfs.stat(file, function(err, stats) {
    if (stats) {
      age = Date.now() - stats.mtimeMs;
      logger.log("debug", "Annotated snapshot for camera " + self.name + " is " + age + "ms old");

      //Only send the annotated snapshot if it's less than 10 seconds old
      if (age < 10000) {
        logger.log("debug", "Serving annotated camera snapshot");
        memfs.readFile(file, function(err, buf) {
          if (err) {
            logger.log("error", "Could not read " + file + " from memfs: " + err.message);
          }

          callback(buf);
        });
      } else {
        logger.log("debug", "Annotated snapshot too old. Serving snapshot from camera plugin");
        self.cameraPlugin.getSnapshot(callback)
      }
    } else {
      logger.log("debug", "Serving snapshot from camera plugin");
      self.cameraPlugin.getSnapshot(callback)
    }
  });
}
