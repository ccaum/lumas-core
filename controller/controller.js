const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const async = require('async');
const grpc = require('grpc');
const util = require('util')
const logConfig = require('./logger.js').config;
const Camera = require('./camera.js');
const { Config } = require('./config.js');
const { HomeKitMotion } = require('./homekit/motion.js');
const { HomeKitCamera } = require('./homekit/camera.js');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

var image_classification_proto_file = PROTO_DIR + '/image_classification.proto';
var image_classification_proto = grpc.load(image_classification_proto_file).classification;
var worker_proto_file = PROTO_DIR + '/worker.proto';
var worker_proto = grpc.load(worker_proto_file).workers;
var logger;

var workers = [];
var cameras = [];
var events = new EventEmitter();

module.exports = {
  startController: startController,
  events: events
}

function loadLogger(globalConfig) {
  logConfig({timezone: globalConfig.timezone, loglevel: globalConfig.loglevel});
  //Load the logger after we've configured it
  logger = require('./logger.js').logger;
}

function generateHomeKitCode(base_code, increment) {
  codeElements = base_code.split('-')
  codeElements[0] = parseInt(codeElements[0]) + increment
  code = codeElements.join('-')
  return code
}

function run(config) {
  let globalConfig = Object.assign({}, config.global)
  let homekit_code = globalConfig.homekit_code
  let camera_homekit_code = generateHomeKitCode(homekit_code, 1)
  let motion_homekit_code = generateHomeKitCode(homekit_code, 2)

  loadLogger(globalConfig)

  //config.plugins.forEach( function(item) {
    //plugin = require('./plugins/' + item + '.js');
  //})

  config.cameras.forEach( function(item) {
    cam = new Camera(item, events);
    streamer = item.streamers[0]

    var homeKitCamera = new HomeKitCamera(cam, streamer.camera_code, streamer.camera_id)
    var homeKitMotion = new HomeKitMotion(cam.name, streamer.motion_code, streamer.motion_id)

    cam.on('frame', function(img) {
      classify(img, function(results) {
        if (results) {
          results['objects'].forEach(function(object) {
            logger.log('debug', "Object recieved: " + JSON.stringify(object));

            if (object.objectClass == 'person') {
              events.emit('classifiedImg', new Buffer(results.annotatedImage.base64Image, 'base64'));
              homeKitMotion.motionDetected();
            }
          });
        }
      });
    });
  });
}

function startController() {
  const self = this;

  var server = new grpc.Server();
  server.addService(worker_proto.Register.service, {register: registerWorker});
  server.bind('[::]:50051', grpc.ServerCredentials.createInsecure());
  server.start();

  config = new Config('/config.yml');
  config.load(run);
}

function registerWorker(request, callback) {
  worker = request.request;
  workers.push(worker);

  logger.log("debug", "Registered new worker " + worker.grpcAddress);

  callback(null, {successful: true});
}

function onWorker(waitForWorker, callback) {
  var worker;

  const interval = setInterval( function() {
    if (workers.length > 0) {
      worker = workers.shift()
      callback(worker)
      clearInterval(interval);
    } else {
      // If we shouldn't wait for a worker to become available 
      // then clear the interval and return
      if (!waitForWorker) {
        clearInterval(interval);
      }
    }
  }, 0);
}

function classify(image, callback) {
  onWorker(false, function(worker) {
    logger.log("debug", "Classifying with worker " + worker.grpcAddress);
    var client = new image_classification_proto.ImageClassification(
      worker.grpcAddress + ':' + worker.grpcPort,
      grpc.credentials.createInsecure());

    var imageToBeClassified = {
      image: {
        base64Image: new Buffer(image).toString('base64'),
      },
      outlineObjects: true,
      classesToOutline: ["person"]
    }

    client.classify(imageToBeClassified, function(err, results) { 
      if (err) {
        logger.log('error', "Could not classify image: " + err);
      }

      if (callback) {
        callback(results);
      }
    });
  });
}
