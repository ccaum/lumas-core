const EventEmitter = require("events").EventEmitter;
const request = require('request');
const http = require('http');
const util = require('util')
const memfs = require('memfs');
const fs = require('fs');
const logger = require('./logger.js');
const retry = require('retry');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');
const Agent = require('agentkeepalive');

module.exports = Camera;

function Camera(config, controllerEvents = undefined) {
  this.name = config.name;

  pluginConfig = config.plugin;
  plugin = require('./plugins/' + pluginConfig.name + '.js');
  constructor = plugin.constructor();
  this.cameraPlugin = new constructor(config.name, pluginConfig.config);

  const self = this;
  this.cameraPlugin.on('frame', function(frame) {
		// Classification expects an encoded image
		var jpg = null;
		try {
			jpg = cv.imencode('.jpg', frame);
			self.emit('image', jpg);
		} catch(error) { logger.log('error', error) }
	});

  EventEmitter.call(self);
}

util.inherits(Camera, EventEmitter);

Camera.prototype.getSnapshot = function (callback) {
  this.cameraPlugin.getSnapshot(callback)
}
