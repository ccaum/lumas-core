const hap = require('hap-nodejs')
const fp = require("find-free-port")
const logger = require('./logger.js').logger
const { FFMPEG } = require('./ffmpeg.js')

hap.init();

// HAP necessities
var Accessory = hap.Accessory;
var uuid = hap.uuid;

module.exports = {
  HomeKitCamera: HomeKitCamera
}

function HomeKitCamera(camera) {
  const config = {
    name: camera.name,
    streamURL: camera.rtspStream,
    id: camera.cameraID,
    homekitCode: camera.cameraCode,
    maxStreams: 2
  }
  
  config.getSnapshot = function (callback) {
    //camera.getSnapshot(callback);
  }
  
  config.source =  ['-i', config.streamURL]
  config.videoConfig = {
    source: config.source,
    maxStreams: 2,
    maxWidth: 1920,
    maxHeight: 1080,
    maxFPS: 10
  }
  
  cameraAccessory = new Accessory('Lumas Camera', uuid.generate(config.name + " Camera"));
  
  var cameraSource = new FFMPEG(hap, config, logger);
  
  cameraAccessory.configureCameraSource(cameraSource);
  
  cameraAccessory.on('identify', function(paired, callback) {
      logger.log('info', "Camera identify");
      callback(); // success
  });
  
  // Find a free port to run the camera HAP on
  fp(5160, 5199, '0.0.0.0', function(err, freePort) {
    logger.log("info", "Running camera " + config.name + " on port " + freePort);
    logger.log("info", "HomeKit code is " + config.homekitCode);
  
    // Publish the camera on the local network.
    cameraAccessory.publish({
      username: config.id,
      port: freePort,
      pincode: config.homekitCode,
      category: Accessory.Categories.CAMERA
    }, true);
  })
}
