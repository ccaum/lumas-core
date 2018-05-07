const EventEmitter = require("events").EventEmitter;
const request = require('request');
const http = require('http');
const util = require('util')
const memfs = require('memfs');
const fs = require('fs');
const logger = require('./logger.js');
const retry = require('retry');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');
const Agent = require('agentkeepalive');

module.exports = Camera;

function Camera(config, controllerEvents = undefined) {
  this.name = config.name;

  if (!config.plugin) {
    throw("Error: Camera configuration must have a plugin defined")
  }

  this.plugin = config.plugin

  //Load camera plugin here

  this.address = this.plugin.config.address;
  this.motionEndpoint = "http://" + this.address + "/cgi-bin/eventManager.cgi?action=attach&codes=[VideoMotion]";
  this.snapshotEndpoint = "http://" + this.address + "/cgi-bin/snapshot.cgi";

  this.auth = {
    user: this.plugin.config.username,
    pass: this.plugin.config.password,
    sendImmediately: false
  }
  this.streamURL = "rtsp://" + this.auth.user +
    ":" + this.auth.pass + "@" + this.address

  this.camera_options = {
    auth: this.auth,
    forever: true
  }

  this.processingFeed = false;
  this.keepaliveAgent = new Agent({
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketKeepAliveTimeout: 30000, // free socket keepalive for 30 seconds
  });

  const self = this;
  if (controllerEvents) {
    controllerEvents.on('classifiedImg', function(imgBuf) {
      memfs.writeFile('/annotatedSnapshot.jpg', imgBuf, function() {});
    });
  }

  setInterval(function () {
    self.captureCameraSnapshot(self)
  }, 10000);

  self.cameraMotionMonitor();
  EventEmitter.call(self);
}

util.inherits(Camera, EventEmitter)

Camera.prototype.captureCameraSnapshot = function (self) {
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
      memfs.readFile('/cameraSnapshot.jpg', (err, data) => {
        if (!err) {
          self.emit('snapshot', data)
        }
      });

      if (process.env.CAMERA_SAVE_SNAPSHOTS === "true") {
        var fsfile = fs.createWriteStream("/snapshots/" + Date.now() + ".jpg");
        memfs.createReadStream('/cameraSnapshot.jpg').pipe(fsfile);
      }
      logger.log('debug', "Succesfully updated camera snapshot");
    })
    .pipe(file);

}

Camera.prototype.processFeed = function () {
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

      // Classification expects an encoded image
      var jpg = null;
      try {
        jpg = cv.imencode('.jpg', frame);
        self.emit('image', jpg);
      } catch(error) { logger.log('error', error) }

    }
  }, 0);

  //Stop processing after 60 seconds
  setTimeout(function() {
    self.processingFeed = false;
    clearInterval(interval)
  }, 60000);
}

Camera.prototype.amcrestMotionMonitor = function () {
  const self = this;

  self.camera_options.agent = self.keepaliveAgent;

  // Connect to the camera and monitor for motion
  request(self.motionEndpoint, self.camera_options)
    .on('abort', function() {
      logger.log('error', "Connection to Camera aborted");
      self.amcrestMotionMonitor();
    })
    .on('error', function(err) {
      logger.log('error', "Error from camera motion monitor: " + err);
      self.amcrestMotionMonitor();
    })
    .on('timeout', function() {
      logger.log('error', "Connection to camera timed out. Trying again");
      self.amcrestMotionMonitor();
    })
    .on('upgrade', function() {
      logger.log('error', "Connection to camera got an upgrade connection request. Reconnecting");
      self.amcrestMotionMonitor();
    })
    .on('close', function() {
      logger.log('info', "Connection to Camera closed");
      self.amcrestMotionMonitor();
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

Camera.prototype.cameraMotionMonitor = function () {
  const self = this;

  //http.createServer(function(request, response) {
  //  self.processFeed();
  //}).listen(9999);

  self.amcrestMotionMonitor();

  setInterval(() => {
    let socketsSize = Object.keys(this.keepaliveAgent.sockets).length;

    if (socketsSize === 0) {
      logger.log('info', "No active sockets found to camera motion endpoint. Creating new session");
      self.amcrestMotionMonitor();
    }
  }, 5000);
}

Camera.prototype.getSnapshot = function(callback) {
  var age;
  var file;

  memfs.stat('/annotatedSnapshot.jpg', function(err, stats) {
    if (stats) {
      age = Date.now() - stats.mtimeMs;
      logger.log("debug", "Annotated snapshot is " + age + "ms old");

      //Only send the annotated snapshot if it's less than 10 seconds old
      if (age < 10000) {
        logger.log("debug", "Serving annotated camera snapshot");
        file = '/annotatedSnapshot.jpg';
      } else {
        logger.log("debug", "Serving cached camera snapshot");
        file = '/cameraSnapshot.jpg';
      }
    } else {
      logger.log("debug", "Serving cached camera snapshot");
      file = '/cameraSnapshot.jpg';
    }

    memfs.readFile(file, function(err, buf) {
      if (err) {
        logger.log("error", "Could not read " + file + " from memfs: " + err.message);
      }

      callback(buf);
    });
  });
}
