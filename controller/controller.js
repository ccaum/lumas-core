const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const async = require('async');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const util = require('util')
const logConfig = require('./logger.js').config;
const Camera = require('./camera');
const { startFFSERVER, addStream } = require('./ffserver');
const { Config } = require('./config.js');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

const proto_options = {
  oneofs: false
}

var plugin_proto_file = PROTO_DIR + '/plugin.proto';
var plugin_definition = protoLoader.loadSync(plugin_proto_file, proto_options);
var plugin_proto = grpc.loadPackageDefinition(plugin_definition).plugin;

var image_classification_proto_file = PROTO_DIR + '/image_classification.proto';
var image_classification_definition = protoLoader.loadSync(image_classification_proto_file, proto_options);
var image_classification_proto = grpc.loadPackageDefinition(image_classification_definition).classification;

var worker_proto_file = PROTO_DIR + '/worker.proto';
var worker_definition = protoLoader.loadSync(worker_proto_file, proto_options);
var worker_proto = grpc.loadPackageDefinition(worker_definition).workers;

var proto_file = PROTO_DIR + '/motion.proto';
var motion_definition = protoLoader.loadSync(proto_file);
var motion_proto = grpc.loadPackageDefinition(motion_definition).imageprocessor;

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

function gRPCServer() {
  var server = new grpc.Server();
  server.addService(worker_proto.Register.service, {register: registerWorker});
  server.addService(plugin_proto.Register.service, {register: registerPlugin});
  server.bind('[::]:50061', grpc.ServerCredentials.createInsecure());
  server.start();
}

function loadCameras() {
  let self = this;
  var motion_rpc = new motion_proto.Motion('localhost:6123', grpc.credentials.createInsecure());


  config.cameras.forEach( function(cameraConfig) {
    var motion_call = motion_rpc.detectMotionStream()
    var cam = new Camera(cameraConfig, events);

    addStream(cam);

    cam.on('image', function(img) {
      motion_call.write({
        base64Image: img
      });
    });

    motion_call.on('data', function(motionResults) {
      if (motionResults.motionDetected == true) {
        focusAreas = motionResults.motionAreas
        img = motionResults.image.base64Image

        classify(img, focusAreas, function(classificationResults) {
          if (classificationResults['objects']) {
            classificationResults['objects'].forEach(function(object) {
              logger.log('debug', "Object recieved: " + JSON.stringify(object));

              // Write the annotated image to disk for review. Delete later
              imageBuffer = new Buffer(classificationResults.annotatedImage.base64Image, 'base64');
              require("fs").writeFile("/app/images/" + new Date() + ".jpg", imageBuffer, 'binary', function(err) {
                if (err) {
                  logger.log('error', err);
                }
              });

              if (object.objectClass == 'person') {
                imageBuffer = new Buffer(classificationResults.annotatedImage.base64Image, 'base64');
                events.emit('classifiedImg', imageBuffer);
              };
            });
          }
        });
      }
    });

    cameras.push(cam);
  });
}

function run(config) {
  let globalConfig = Object.assign({}, config.global);

  startFFSERVER();
  loadCameras();
  gRPCServer();
}

function startController() {
  config = new Config('/config.yml');
  config.load().then(function(configObj) {
    let globalConfig = Object.assign({}, configObj.global);
    loadLogger(globalConfig);

    run(configObj);
  }, function(error) {
    logger.log('error', "Could not load config: " + error);
  });
}

function registerPlugin(call, callback) {
  request = call.request;

  events.emit('plugin', request);

  callback(null, {successful: true});
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

function classify(image, focusAreas, callback) {
  onWorker(false, function(worker) {
    logger.log("debug", "Classifying with worker " + worker.grpcAddress);
    var client = new image_classification_proto.ImageClassification(
      worker.grpcAddress + ':' + worker.grpcPort,
      grpc.credentials.createInsecure());

    var imageToBeClassified = {
      image: {
        base64Image: image
      },
      focusAreas: focusAreas,
      outlineObjects: true,
      //classesToOutline: ["person"]
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
