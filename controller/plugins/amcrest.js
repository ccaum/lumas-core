const EventEmitter = require("events").EventEmitter;
const Agent = require('agentkeepalive');
const request = require('request');
const http = require('http');
const util = require('util')
const memfs = require('memfs');
const fs = require('fs');
const logger = require('../logger.js').logger;
const Camera = require('../camera.js');
const retry = require('retry');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');

module.exports = { constructor, Amcrest };

function constructor() {
  return Amcrest
}

function Amcrest(cameraName, config) {
  const self = this;

  this.name = cameraName;
  this.processFeedListenPort = config.listen_port;
  this.address = config.address

  this.motionEndpoint = "http://" + this.address + "/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]";
  this.snapshotEndpoint = "http://" + this.address + "/cgi-bin/snapshot.cgi";

  this.auth = {
    user: config.username,
    pass: config.password,
    sendImmediately: false
  }
  this.streamURL = "rtsp://" + this.auth.user +
    ":" + this.auth.pass + "@" + this.address

  this.processingFeed = false;
  this.keepaliveAgent = new Agent({
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketKeepAliveTimeout: 30000, // free socket keepalive for 30 seconds
  });

  setInterval(function () {
    self.captureCameraSnapshot(self)
  }, 10000);

  self.cameraMotionMonitor();
  EventEmitter.call(self);
}

util.inherits(Amcrest, Camera);

Amcrest.prototype.captureCameraSnapshot = function (self) {
  var file = memfs.createWriteStream('/cameraSnapshot.jpg');

  request
    .get(self.snapshotEndpoint, {
      auth: self.auth
    })
    .on('response', function(response) {
      if (response.statusCode == 401) {
        logger.log('error', "Unauthorized to access camera snapshot API");
      }
    })
    .on('error', function(err) {
      logger.log('error', "Error message: " + err);
    })
    .on('end', function() {
      if (process.env.CAMERA_SAVE_SNAPSHOTS === "true") {
        var fsfile = fs.createWriteStream("/snapshots/" + Date.now() + ".jpg");
        memfs.createReadStream('/cameraSnapshot.jpg').pipe(fsfile);
      }
      logger.log('debug', "Succesfully updated camera snapshot");
    })
    .pipe(file);
}

Amcrest.prototype.processFeed = function () {
  const self = this;
  let cap;

  if (self.processingFeed) {
    logger.log('debug', "Already processing camera feed. Ignoring");
    return;
  } else {
    self.processingFeed = true;
  }

  var cameraOperation = retry.operation({ maxTimeout: 60 * 1000});

  cameraOperation.attempt( function() {
    cap = new cv.VideoCapture(self.streamURL);
  });

  const interval = setInterval(() => {
    let frame = cap.read();

    if (frame && !frame.empty) {
      self.emit('frame', frame);
    }
  }, 0);

  //Stop processing after 60 seconds
  setTimeout(function() {
    self.processingFeed = false;
    clearInterval(interval)
  }, 60000);
}

Amcrest.prototype.motionMonitor = function () {
  const self = this;

  camera_options = {
    auth: self.auth,
    forever: true,
    agent: self.keepaliveAgent
  }

  // Connect to the camera and monitor for motion
  request(self.motionEndpoint, camera_options)
    .on('abort', function() {
      logger.log('error', "Connection to Camera aborted");
      self.motionMonitor();
    })
    .on('error', function(err) {
      logger.log('error', "Error from camera motion monitor: " + err);
      self.motionMonitor();
    })
    .on('timeout', function() {
      logger.log('error', "Connection to camera timed out. Trying again");
      self.motionMonitor();
    })
    .on('upgrade', function() {
      logger.log('error', "Connection to camera got an upgrade connection request. Reconnecting");
      self.motionMonitor();
    })
    .on('close', function() {
      logger.log('info', "Connection to Camera closed");
      self.motionMonitor();
    })
    .on('response', function(res) {
      code = null;
      action = null;
      index = null;

      res.on('data', function (body) {
        data = body.toString('utf8');

        if (data.substring(0,2) == '--') {
          logger.log('debug', 'Receeived response from camera: ' + data);
          lines = data.split('\r\n')

          codeString = lines[3].split(';')[0]
          actionString = lines[3].split(';')[1]
          indexString = lines[3].split(';')[2]

          code = codeString.split('=')[1]
          action = actionString.split('=')[1]
          index = indexString.split('=')[1]

          if (action == 'Start') {
            self.processFeed();
          }
        }
      })
    });
}

Amcrest.prototype.cameraMotionMonitor = function () {
  const self = this;

  if (self.processFeedListenPort) {
    http.createServer(function(request, response) {
      self.processFeed();
    }).listen(self.processFeedListenPort);
  }

  self.motionMonitor();

  setInterval(() => {
    let socketsSize = Object.keys(this.keepaliveAgent.sockets).length;

    if (socketsSize === 0) {
      logger.log('info', "No active sockets found to camera motion endpoint. Creating new session");
      self.motionMonitor();
    }
  }, 5000);
}

Amcrest.prototype.getSnapshot = function(callback) {
  const file = "/cameraSnapshot.jpg"

  memfs.readFile(file, function(err, buf) {
    if (err) {
      logger.log("error", "Could not read " + file + " from memfs: " + err.message);
    }

    callback(buf);
  });
}
