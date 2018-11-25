const fs = require('fs');
const util = require('util')
const EventEmitter = require("events").EventEmitter;
const yaml = require('js-yaml');
const logger = require('./logger.js').logger;

module.exports = {
  Config: Config
}

function Config(file) {
  this.file = file;
  EventEmitter.call(this);
}

util.inherits(Config, EventEmitter);

Config.prototype.load = function () {
  const self = this;
  return new Promise(function(resolve, reject) {
    self.config;
    self.plugins;
    self.cameras;
    self.conditions;
    self.global;

    self.loadConfig(self.file, resolve, reject);
  });
}

Config.prototype.setConfig = function (config) {
  this.config = config;
  this.plugins = this.config.plugins;
  this.cameras = this.config.cameras;
  this.conditions = this.conditions;
  this.global = this.config.global;
}

Config.prototype.loadConfig = function (file, resolve, reject) {
  const self = this;

  let config = fs.readFile(file, (err, data) => {
    if (err) {
      logger.log('error', "Could not load config file: " + err);
      reject("Could not load config file: " + err);
    }

    self.setConfig(yaml.safeLoad(data));

    resolve(self);
  });
}
