const EventEmitter = require("events").EventEmitter;
const request = require('request');
const http = require('http');
const util = require('util')
const memfs = require('memfs');
const fs = require('fs');
const logger = require('../logger.js').logger;
const CameraProvider = require('./provider.js');
const VideoStreamer = require('./streamer.js');

module.exports = Camera;

function Camera(config, controllerEvents) {
  this.controllerEvents = controllerEvents;
  this.name = config.name;
  this.config = config;
  this.provider = null;
  this.streamers = [];
  this.conditions = null;

  let self = this;
  if (config.plugin === undefined) {
    logger.log('error', "No plugin defined for camera '" + config.name + "'");
    return;
  } else {
    //Listen for new plugins being registered. If one is the one we're looking for, create
    // an instance of it for this camera.
    controllerEvents.on('plugin', function(plugin) {
      plugin.pluginServices.forEach( function(service) {
        if (service.type === 'CameraProvider' && plugin.name === self.config.plugin.name) {
          self.provider = new CameraProvider(plugin.name, plugin.grpcAddress, plugin.grpcPort, service.configProtobuf, self.config.plugin.config);
        }

        self.stream( function(err, stream) {
          if (err) {
            logger.log('error', 'Could not stream: ' + err);
          } else {
            stream.on('data', function(request) {
              img = request.base64Image;

              self.emit('image', img);
            });
          }
        });
      });
    });
  }

  if (config.streamers !== undefined && config.streamers.length != 0) {
    //Listen for new plugins being registered. If one is a streamer we're looking for, create
    // an instance for this camera.
    controllerEvents.on('plugin', function(plugin) {
      plugin.pluginServices.forEach( function(service) {
        if (service.type === 'VideoStreamer') {
          self.loadStreamer(plugin, service.configProtobuf);
        }
      });
    });
  }
}

util.inherits(Camera, EventEmitter);

Camera.prototype.loadStreamer = function(plugin, configProtobuf) {
  let self = this;

  Object.keys(self.config.streamers).forEach( function(key) {
    if (key === plugin.name) {
      streamer = new VideoStreamer(plugin.name, plugin.grpcAddress, plugin.grpcPort, configProtobuf, self.config.streamers[key]);
      self.streamers.push(streamer);
    }
  });
}

Camera.prototype.getSnapshot = function(callback) {
  if (this.provider === null) {
    error = "Camera provider '" + this.config.plugin.name + "' not registered yet";
    callback(error, null);
    return;
  } else {
    this.provider.snapshot(null, callback);
  }
}

Camera.prototype.stream = function(callback) {
  if (this.provider === null) {
    error = "Camera provider '" + this.config.plugin.name + "' not registered yet";
    callback(error, null);
    return;
  } else {
    this.provider.stream(callback);
  }
}
