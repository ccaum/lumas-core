const hap = require('hap-nodejs')
const fp = require("find-free-port")
const logger = require('../logger.js')
const { FFMPEG } = require('./ffmpeg.js')

hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var uuid = hap.uuid;

const config = {
  name: "Amcrest Camera",
  username: process.env.CAMERA_USER,
  password: process.env.CAMERA_PASS,
  address: process.env.CAMERA_ADDRESS,
  maxStreams: 2
}

config.source =  "-rtsp_transport tcp -re -i rtsp://" + config.username + ":" + config.password + "@" + config.address

config.videoConfig = {
  source: config.source,
  stillImageSource: "-i http://admin:4RtQd222NLBsn7j43f7jnHoJ@192.168.2.201/cgi-bin/snapshot.cgi",
  maxStreams: 2,
  maxWidth: 1920,
  maxHeight: 1080,
  maxFPS: 10
}

cameraAccessory = new Accessory('Amcrest Camera', uuid.generate("Amcrest Camera"));

var cameraSource = new FFMPEG(hap, config, logger);

cameraAccessory.configureCameraSource(cameraSource);

cameraAccessory.on('identify', function(paired, callback) {
    console.log("Amcrest Camera identify");
    callback(); // success
});

// Find a free port to run the camera HAP on
fp(5160, 5199, '0.0.0.0', function(err, freePort) {
  logger.log("info", "Running camera " + config.name + " on port " + freePort);

  // Publish the camera on the local network.
  cameraAccessory.publish({
    username: "EC:22:3D:D3:CE:CE",
    port: freePort,
    pincode: "431-48-159",
    category: Accessory.Categories.CAMERA
  }, true);
})
