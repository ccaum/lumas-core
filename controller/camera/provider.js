const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const logger = require('../logger.js').logger;

module.exports = CameraProvider;

function CameraProvider(name, grpcAddress, grpcPort, configProtobuf, config) {
  this.name = name;
  this.grpcAddress = grpcAddress;
  this.grpcPort = grpcPort;
  this.configProtobuf = configProtobuf;
  this.config = config;
  this.rpcClient= null;

  this.loadClient();
}

CameraProvider.prototype.getSnapshot = function(callback) {
  if (this.rpcClient === null) {
    error = "Camera provider '" + this.type + "' not connected yet";
    logger.log('error', error);
    
    callback(error, null);
    return;
  }

  this.rpcClient.snapshot(this.config, callback);
}

CameraProvider.prototype.stream = function(callback) {
  if (this.rpcClient === null) {
    error = "Camera provider '" + this.type + "' not connected yet";
    logger.log('error', error);
    
    callback(error, null);
    return;
  }

  var rpcCall = this.rpcClient.stream(this.config);
  callback(null, rpcCall);
}

CameraProvider.prototype.loadClient = function(provider) {
  let self = this;

  providerProtoFileName = "/" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '.proto';

  try {
    fs.writeFileSync(providerProtoFileName, self.configProtobuf)
  } catch (e) {
    logger.log('error', 'Could not write camera provider ' + camera.plugin.name + ' protobuf to file ' + providerProtoFileName + ': ' + e);
    return;
  };

  var provider_definition = protoLoader.loadSync(providerProtoFileName);
  var provider_proto = grpc.loadPackageDefinition(provider_definition).cameraprocessor;

  //Delete the temp proto file so it's not eating up tmpfs space
  fs.unlink(providerProtoFileName);

  logger.log('debug', "Setting camera provider at " + self.grpcAddress + ":" + self.grpcPort);
  var client = new provider_proto.Camera(
    self.grpcAddress + ':' + self.grpcPort,
    grpc.credentials.createInsecure());

  self.rpcClient = new provider_proto.Camera(
    self.grpcAddress + ':' + self.grpcPort,
    grpc.credentials.createInsecure());
}
