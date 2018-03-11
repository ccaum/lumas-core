var hap = require('hap-nodejs')
hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var Service = hap.Service;
var Characteristic = hap.Characteristic;
var uuid = hap.uuid;
var shouldNotify = true;

// here's a fake hardware device that we'll expose to HomeKit
var MOTION_SENSOR = {
  motionDetected: false,

  getStatus: function() {
    //set the boolean here, this will be returned to the device
    MOTION_SENSOR.motionDetected = false;
  },
  identify: function() {
    console.log("Identify the motion sensor!");
  }
}

// Generate a consistent UUID for our Motion Sensor Accessory that will remain the same even when
// restarting our server. We use the `uuid.generate` helper function to create a deterministic
// UUID based on an arbitrary "namespace" and the word "motionsensor".
var motionSensorUUID = uuid.generate('hap-nodejs:accessories:motionsensor');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake motionSensor.
var motionSensor = exports.accessory = new Accessory('Object Sensor', motionSensorUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
motionSensor.username = "1A:2B:3D:4A:1E:AD";
motionSensor.pincode = "031-25-359";

// set some basic properties (these values are arbitrary and setting them is optional)
motionSensor
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Oltica")
  .setCharacteristic(Characteristic.Model, "Rev-1")
  .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

// listen for the "identify" event for this Accessory
motionSensor.on('identify', function(paired, callback) {
  MOTION_SENSOR.identify();
  callback(); // success
});

motionSensor
  .addService(Service.MotionSensor, "Object Sensor") // services exposed to the user should have "names" like "Fake Motion Sensor" for us
  .getCharacteristic(Characteristic.MotionDetected)
  .on('get', function(callback) {
     MOTION_SENSOR.getStatus();
     callback(null, Boolean(MOTION_SENSOR.motionDetected));
});

motionSensor.publish({
  port: 51826,
  username: motionSensor.username,
  pincode: motionSensor.pincode
});

exports.motionDetected = function(state = true) {
  if (shouldNotify) {
    shouldNotify = false;

    motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, state);

    // Do not notify again for another 10 minutes
    setTimeout( function() {
      logger.log('info', 'Resetting HomeKit notification timer');
      shouldNotify = true;
    }, 300000)
  }
};
