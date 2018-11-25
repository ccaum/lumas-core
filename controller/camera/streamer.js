const EventEmitter = require("events").EventEmitter;
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const util = require('util');
const fs = require('fs');
const logger = require('../logger.js').logger;

module.exports = VideoStreamer;

function VideoStreamer(name, grpcAddress, grpcPort, configProtobuf, config) {
  this.name = name;
  this.grpcAddress = grpcAddress;
  this.grpcPort = grpcPort;
  this.configProtobuf = configProtobuf;
  this.config = config;
  this.cameraID = '';
  this.rpcClient = null;

  //Not all config protobufs will support a name field.
  // We should dynamically figure out if they do
  this.config['name'] = this.name;

  let self = this;
  this.loadClient( function() {
    self.setCamera();
  });
}

VideoStreamer.prototype.setCamera = function(callback) {
  let self = this;

  var rpcCall = this.rpcClient.registerCamera(this.config, function(err, cameraID) {
    if (err) {
      logger.log('error', "Could not register camera with '" + self.name + "' streamer: " + err.message);
      return;
    } else {
      logger.log('info', "Successfully registered camera with '" + self.name + "' streamer");

      self.cameraID = cameraID.id
    }
  });
}

VideoStreamer.prototype.loadClient = function(callback) {
  let self = this;

  streamerProtoFileName = "/" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '.proto';

  try {
    fs.writeFileSync(streamerProtoFileName, self.configProtobuf)
  } catch (e) {
    logger.log('error', 'Could not write camera streamer ' + self.name + ' protobuf to file ' + streamerProtoFileName + ': ' + e);
    return;
  };

  var streamer_definition = protoLoader.loadSync(streamerProtoFileName);
  var streamer_proto = grpc.loadPackageDefinition(streamer_definition).camerastreamer;

  //Delete the temp proto file so it's not eating up tmpfs space
  fs.unlink(streamerProtoFileName);

  logger.log('debug', "Setting video streamer at " + self.grpcAddress + ":" + self.grpcPort);
  self.rpcClient = new streamer_proto.Camera(
    self.grpcAddress + ':' + self.grpcPort,
    grpc.credentials.createInsecure());

  callback();
}
