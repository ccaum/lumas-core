const hap = require('hap-nodejs')
const fp = require("find-free-port")
const logger = require('./logger.js').logger
hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var Service = hap.Service;
var Characteristic = hap.Characteristic;
var uuid = hap.uuid;

module.exports = {
  HomeKitMotion: HomeKitMotion,
}

function HomeKitMotion(motion) {
  const config = {
    name: motion.name,
    id: motion.motionID,
    homekitCode: motion.motionCode
  }

  this.motion = false;
  this.timeout = null;

  motionSensorUUID = uuid.generate("hap-nodejs:accessories:motionsensor:" + config.name);
  
  // This is the Accessory that we'll return to HAP-NodeJS that represents our fake motionSensor.
  this.motionSensor = exports.accessory = new Accessory("Lumas " + config.name + " Motion Sensor", motionSensorUUID);
  var motionSensor = this.motionSensor;
   
  // listen for the "identify" event for this Accessory
  this.motionSensor.on('identify', function(paired, callback) {
    callback(); // success
  });
  
  this.motionSensor
    .addService(Service.MotionSensor, "Motion Sensor")
    .getCharacteristic(Characteristic.MotionDetected)
    .on('get', function(callback) {
       this.motion;
       callback(null, Boolean(this.motion));
  });

  // Find a free port to run the motion HAP on
  fp(5260, 5299, '0.0.0.0', function(err, freePort) {
    logger.log("info", "Running motion " + config.name + " on port " + freePort);
  
    // Publish the motion sensor on the local network.
    motionSensor.publish({
      username: config.id,
      port: freePort,
      pincode: config.homekitCode,
      category: Accessory.Categories.MotionSensor
    }, true);
  })
};

HomeKitMotion.prototype.motionDetected = function(state = true) {
  let self = this;

  if (self.timeout != null) {
    clearTimeout(self.timeout);
  }

  if (self.motion !== state) {
    self.motion = state
    self.motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, state);
  }

  // Do not notify again for another 5 minutes
  self.timeout = setTimeout( function() {
    self.motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, false);

    self.motion = false;

    self.timeout = null;
  }, 300000);
};

