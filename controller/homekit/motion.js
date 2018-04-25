var hap = require('hap-nodejs')
hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var Service = hap.Service;
var Characteristic = hap.Characteristic;
var uuid = hap.uuid;
var timeout = null;
var homekitCode = process.env.HOMEKIT_CODE;

// here's a fake hardware device that we'll expose to HomeKit
var MOTION_SENSOR = {
  motionDetected: false,

  getStatus: function() {
    //set the boolean here, this will be returned to the device
    return MOTION_SENSOR.motionDetected;
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
var motionSensor = exports.accessory = new Accessory('Lumas Person Sensor', motionSensorUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
motionSensor.username = "1A:2B:3D:4A:1E:AD";
motionSensor.pincode = homekitCode;

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
  .addService(Service.MotionSensor, "Lumas Person Sensor")
  .getCharacteristic(Characteristic.MotionDetected)
  .on('get', function(callback) {
     MOTION_SENSOR.motionDetected;
     callback(null, Boolean(MOTION_SENSOR.motionDetected));
});

motionSensor.publish({
  port: 51826,
  username: motionSensor.username,
  pincode: motionSensor.pincode
});

exports.motionDetected = function(state = true) {
  if (timeout != null) {
    clearTimeout(timeout);
  }

  if (MOTION_SENSOR.motionDetected !== state) {
    MOTION_SENSOR.motionDetected = state
    motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, state);
  }

  // Do not notify again for another 5 minutes
  timeout = setTimeout( function() {
    motionSensor
      .getService(Service.MotionSensor)
      .updateCharacteristic(Characteristic.MotionDetected, false);

    MOTION_SENSOR.motionDetected = false;

    timeout = null;
  }, 300000);
};
