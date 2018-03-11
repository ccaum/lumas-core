const EventEmitter = require("events").EventEmitter;
const fs = require('fs');
const async = require('async');
const grpc = require('grpc');
const util = require('util')
const logger = require('./logger.js');
const Camera = require('./camera.js');
const { motionDetected } = require('./homekit/motion.js');
const { camera } = require('./homekit/camera.js');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

var image_classification_proto_file = PROTO_DIR + '/image_classification.proto';
var image_classification_proto = grpc.load(image_classification_proto_file).classification;
var worker_proto_file = PROTO_DIR + '/worker.proto';
var worker_proto = grpc.load(worker_proto_file).workers;

var workers = [];

module.exports = startController;

function startController() {

  var server = new grpc.Server();
  server.addService(worker_proto.Register.service, {register: registerWorker});
  server.bind('[::]:50051', grpc.ServerCredentials.createInsecure());
  server.start();

  var camera = new Camera();

  camera.on('image', function(img) {
    classify(img, function(results) {
      results['objects'].forEach(function(object) {
        logger.log('debug', "Object recieved: " + JSON.stringify(object));

        if (object.objectClass == 'car') {
          notifyHomeKit();
        }
      });
    });
  });

  //Set up the event emitter
  EventEmitter.call(this);
}

util.inherits(startController, EventEmitter);

function notifyHomeKit() {
  motionDetected(true);

  // Do not notify again for another 5 minutes
  setTimeout( function() {
    logger.log('info', 'Resetting HomeKit notification timer');
    motionDetected(false);
  }, 300000)
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
      classesToOutline: ["car"]
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
