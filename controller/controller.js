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

function loadCamera(id, camera, processor) {
  protoFileName = "/" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '.proto';

  plugin = processor['plugin'];
  processor = processor['processor'];

  try {
    fs.writeFileSync(protoFileName, processor.configProtobuf)
  } catch (e) {
    logger.log('error', 'Could not write camera processor ' + camera.plugin.name + ' to file ' + protoFileName + ': ' + e);
  };

  var camera_config_definition = protoLoader.loadSync(protoFileName);
  var camera_config_proto = grpc.loadPackageDefinition(camera_config_definition).cameraprocessor;

  //Delete the temp proto file so it's not eating up tmpfs space
  fs.unlink(protoFileName);

  logger.log('debug', "Setting camera processor at " + plugin.grpcAddress + ":" + plugin.grpcPort);
  var client = new camera_config_proto.Camera(
    plugin.grpcAddress + ':' + plugin.grpcPort,
    grpc.credentials.createInsecure());


  client.camera(camera.plugin.config, function(err, cameraID) {
    if (err) {
      logger.log('error', "Could not create camera with processor '" + camera.plugin.name + "'. " +  err.message);
    }

    cameras[id]['processor'] = {cameraID: cameraID.id, plugin: cameraProcessors[camera.plugin.name]};

    var camera_rpc = new camera_processor_proto.Camera(
      plugin.grpcAddress + ':' + plugin.grpcPort,
      grpc.credentials.createInsecure());

    logger.log("debug", "Detecting motion");

    var motion_rpc = new image_classification_proto.ImageClassification(
      worker.grpcAddress + ':' + worker.grpcPort,
      grpc.credentials.createInsecure());

    var call = camera_rpc.stream({id: cameraID.id});
    call.on('data', function(request) {
      img = request.base64Image;

      classify(img, function(results) {
        if (results['objects']) {
          results['objects'].forEach(function(object) {
            logger.log('debug', "Object recieved: " + JSON.stringify(object));

            if (object.objectClass == 'person') {
              events.emit('classifiedImg', new Buffer(results.annotatedImage.base64Image, 'base64'));
            };
          });
        }
      });
    });
  });
}

function loadCameras() {
  let self = this;
  config.cameras.forEach( function(cameraConfig) {
    cam = new Camera(cameraConfig, events);
    addStream(cam);

    //cam.on('image', function(img) {
    //  classify(img, function(results) {
    //    if (results['objects']) {
    //      results['objects'].forEach(function(object) {
    //        logger.log('debug', "Object recieved: " + JSON.stringify(object));
    //
    //        if (object.objectClass == 'person') {
    //          events.emit('classifiedImg', new Buffer(results.annotatedImage.base64Image, 'base64'));
    //        };
    //      });
    //    }
    //  });
    //});

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

function classify(image, callback) {
  onWorker(false, function(worker) {
    logger.log("debug", "Classifying with worker " + worker.grpcAddress);
    var client = new image_classification_proto.ImageClassification(
      worker.grpcAddress + ':' + worker.grpcPort,
      grpc.credentials.createInsecure());

    var imageToBeClassified = {
      image: {
        base64Image: image
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
