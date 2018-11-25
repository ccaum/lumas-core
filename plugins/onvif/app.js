//const onvif = require('./onvif.js');
const fp = require("find-free-port")
const logConfig = require('./logger.js').config;
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const url = require('url');
const fs = require('fs');
const {ONVIF} = require('./onvif.js');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

var camera_proto_file = "/app/protos/onvif_processor.proto";
var camera_buf = fs.readFileSync(camera_proto_file);
var camera_definition = protoLoader.loadSync(camera_proto_file);
var camera_proto = grpc.loadPackageDefinition(camera_definition).cameraprocessor;
var plugin_proto_file = PROTO_DIR + '/plugin.proto';
var plugin_definition = protoLoader.loadSync(plugin_proto_file);
var plugin_proto = grpc.loadPackageDefinition(plugin_definition).plugin;
var logger;

var cameras = [];

var pluginServices = [
  {type: "CameraProvider",
   configProtobuf: camera_buf,
  }
]
 
const config = {
  name: 'onvif',
  controllerURL: process.env['CONTROLLER_URL'],
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

function getStream(call) {
  var camConfig = call.request;
  var cam = new ONVIF(camConfig);

  cam.processFeed();

  cam.on('frame', function(frame) {
    encodedFrame = frame.toString('base64');
    call.write({base64Image: encodedFrame})
  });
}

function getSnapshot(call, callback) {
  var camConfig = call.request;

  var cam = new ONVIF(camConfig);
  var snapshot = cam.getSnapshot();
  callback(null, snapshot);
}

function startgRPCServer(port){
  var server = new grpc.Server();
  server.addService(camera_proto.Camera.service, {
    stream: getStream,
    snapshot: getSnapshot
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
