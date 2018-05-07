const fs = require('fs');
const yaml = require('js-yaml');
const logger = require('./logger.js');

module.exports = {
  Config: Config
}

function Config(file) {
  this.file = file;
}

Config.prototype.load = function (callback) {
  this.config;
  this.plugins;
  this.cameras;
  this.conditions;

  this.loadConfig(this.file, callback);
}

Config.prototype.setConfig = function (config) {
  this.config = config;
  this.plugins = this.config.plugins;
  this.cameras = this.config.cameras;
  this.conditions = this.conditions;
}

Config.prototype.loadConfig = function (file, callback) {
  const self = this;

  let config = fs.readFile(file, (err, data) => {
    if (err) logger.log('error', "Could not load config file: " + err);

    console.log(data);
    self.setConfig(yaml.safeLoad(data));
    callback(self);
  });
}
