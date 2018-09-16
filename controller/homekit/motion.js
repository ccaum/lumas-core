const hap = require('hap-nodejs')
const fp = require("find-free-port")
const logger = require('../logger.js').logger
hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var Service = hap.Service;
var Characteristic = hap.Characteristic;
var uuid = hap.uuid;
var timeout = null;

module.exports = {
  HomeKitMotion: HomeKitMotion,
}

function HomeKitMotion(name, homekit_code) {
  this.motion = false;

  motionSensorUUID = uuid.generate("hap-nodejs:accessories:motionsensor:" + name);
  
  // This is the Accessory that we'll return to HAP-NodeJS that represents our fake motionSensor.
  this.motionSensor = exports.accessory = new Accessory("Lumas " + name + " Motion Sensor", motionSensorUUID);
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
    logger.log("info", "Running motion " + name + " on port " + freePort);
  
    // Publish the motion sensor on the local network.
    motionSensor.publish({
      username: "DD:22:12:BB:AA:FF",
      port: freePort,
      pincode: homekit_code,
      category: Accessory.Categories.MotionSensor
    }, true);
  })

};

HomeKitMotion.prototype.motionDetected = function(state = true) {
  if (timeout != null) {
    clearTimeout(timeout);
  }

  if (this.motion !== state) {
    this.motion = state
    this.motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, state);
  }

  // Do not notify again for another 5 minutes
  timeout = setTimeout( function() {
    motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, false);

    this.motion = false;

    timeout = null;
  }, 300000);
};

