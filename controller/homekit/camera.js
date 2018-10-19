const hap = require('hap-nodejs')
const fp = require("find-free-port")
const logger = require('../logger.js').logger
const { FFMPEG } = require('./ffmpeg.js')

hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var uuid = hap.uuid;

module.exports = {
  HomeKitCamera: HomeKitCamera
}

function HomeKitCamera(camera, homekit_code, homekit_id) {
  const config = {
    name: camera.name,
    username: camera.cameraPlugin.auth.user,
    password: camera.cameraPlugin.auth.pass,
    address: camera.cameraPlugin.address,
    id: homekit_id,
    homekitCode: homekit_code,
    maxStreams: 2
  }
  
  config.getSnapshot = function (callback) {
    camera.getSnapshot(callback);
  }
  
  config.source =  "-rtsp_transport tcp -re -i rtsp://" + config.username + ":" + config.password + "@" + config.address
  
  config.videoConfig = {
    source: config.source,
    stillImageSource: "-i http://" + config.username + ":" + config.password + "@" + config.address + "/cgi-bin/snapshot.cgi",
    maxStreams: 2,
    maxWidth: 1920,
    maxHeight: 1080,
    maxFPS: 10
  }
  
  cameraAccessory = new Accessory('Lumas Camera', uuid.generate(config.name + " Camera"));
  
  var cameraSource = new FFMPEG(hap, config, logger);
  
  cameraAccessory.configureCameraSource(cameraSource);
  
  cameraAccessory.on('identify', function(paired, callback) {
      console.log("Camera identify");
      callback(); // success
  });
  
  // Find a free port to run the camera HAP on
  fp(5160, 5199, '0.0.0.0', function(err, freePort) {
    logger.log("info", "Running camera " + config.name + " on port " + freePort);
  
    // Publish the camera on the local network.
    cameraAccessory.publish({
      username: config.id,
      port: freePort,
      pincode: config.homekitCode,
      category: Accessory.Categories.CAMERA
    }, true);
  })
}
