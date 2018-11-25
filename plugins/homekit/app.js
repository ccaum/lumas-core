const fp = require("find-free-port")
const logConfig = require('./logger.js').config;
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const url = require('url');
const { HomeKitMotion } = require('./motion.js');
const { HomeKitCamera } = require('./camera.js');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

var homekit_config_proto_file = "/app/protos/homekit_streamer.proto";
var homekit_config_buf = fs.readFileSync(homekit_config_proto_file);
var homekit_config_definition = protoLoader.loadSync(homekit_config_proto_file);
var homekit_config_proto = grpc.loadPackageDefinition(homekit_config_definition).camerastreamer;
var plugin_proto_file = PROTO_DIR + '/plugin.proto';
var plugin_definition = protoLoader.loadSync(plugin_proto_file);
var plugin_proto = grpc.loadPackageDefinition(plugin_definition).plugin;

var logger;

var cameras = [];
var motions = [];

var pluginServices = [
  {type: "VideoStreamer",
   configProtobuf: homekit_config_buf,
  }
]
 
const config = {
  name: 'homekit_camera',
  controllerURL: process.env['CONTROLLER_URL'] || 'grpc://localhost:50061',
  address: process.env['ADDRESS'] || 'localhost',
  port: process.env['GRPC_PORT'],
  logging: {
    timezone: process.env['TIMEZONE'],
    loglevel: process.env['LOGLEVEL'],
    filename: process.env['LOGFILE']
  }
}

function main() {

  if (config.port) {
    startgRPCServer(config.port);
  } else {
    // Find a free port to run the camera HAP on
    fp(50160, 50199, '0.0.0.0', function(err, freePort) {
      if (err) {
        logger.log('error', "Could not find free GRPC port: " + err.message);
      }

      logger.log('debug', "Listening for grpc calls on port " + freePort);
      config.port = freePort;

      startgRPCServer(config.port);
    })
  }

  loadLogger(config.logging);

  register();
}

function registerCamera(call, callback) {
  request = call.request;

  this.cameraConfig = {
    name: request.name,
    rtspStream: request.rtspStream,
    cameraCode: request.cameraCode,
    cameraID: request.cameraID
  }

  this.motionConfig = {
    name: request.name,
    motionCode: request.motionCode,
    motionID: request.motionID
  }

  //push nothing so we can reserve an array element. This needs to change to use a cache store
  id = cameras.push('');
  motions.push('');
  id -= 1; //push returns the next element so we have to subtract 1

  camera = new HomeKitCamera(this.cameraConfig)
  motion = new HomeKitMotion(this.motionConfig)

  cameras[id] = camera;
  motions[id] = motion;

  cameraID = {
    id: id
  }

  callback(null, cameraID);
}

function setMotion(call, callback) {
  id = call.request.id;

  motions[id].motionDetected();

  var motionResults = {
    success: true,
    errType: null,
    errMessage: null
  }

  callback(null, motionResults);
}

function startgRPCServer(port) {
  var server = new grpc.Server();
  server.addService(homekit_config_proto.Camera.service, {
    registerCamera: registerCamera,
    setMotion: setMotion
  });
  server.bind('[::]:' + config.port, grpc.ServerCredentials.createInsecure());
  server.start();
}

function registerCallback(error, registration) {
  if (!registration) {
    logger.log('error', 'Could not register plugin controller. Retrying');
    register();
    return;
  }

  if (error) {
    logger.log('error', 'Could not register plugin with controller: ' + error.message + '. Retrying');
    register();
    return;
  }

  if (registration && !registration.successful) {
    logger.log('error', 'Could not register plugin with controller due to ' + registration.errorKind + ': ' + registration.message);
    return;
  }

  if (registration && registration.successful === true) {
    logger.log('info', 'Successfully registered plugin with controller');
  }
}

function register() {
  controller = url.parse(config.controllerURL);

  const register_params = {
    name: config.name,
    grpcPort: config.port,
    grpcAddress: config.address,
    pluginServices: pluginServices  
  }

  if (controller.protocol === 'grpc:') {
		var client = new plugin_proto.Register(controller.host, grpc.credentials.createInsecure());
    client.register(register_params, registerCallback);
  }
}

function loadLogger(config) {
  logConfig(config);
  //Load the logger after we've configured it
  logger = require('./logger.js').logger;
}

main();
