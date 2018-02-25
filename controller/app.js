const request = require('request');
const WebSocket = require('ws');
const async = require('async');
const http = require('http');
const fs = require('fs');
const memfs = require('memfs');
const grpc = require('grpc');
const cv = require('/node_modules/opencv4nodejs/lib/opencv4nodejs');

var shouldNotify = true
var loglevel = process.env.LOG_LEVEL || 'info';
var workers = []

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../protos';
}

var image_classification_proto_file = PROTO_DIR + '/image_classification.proto';
var image_classification_proto = grpc.load(image_classification_proto_file).classification;
var worker_proto_file = PROTO_DIR + '/worker.proto';
var worker_proto = grpc.load(worker_proto_file).workers;

//Winston nodejs logger
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  level: loglevel,
  format: combine(
    timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/app/logs/controller.log' })
  ]
});

const camera_options = {
  auth: {
    user: process.env.CAMERA_USER,
    pass: process.env.CAMERA_PASS,
    sendImmediately: false
  },
  forever: true
};

http.createServer(function (req, res) {
  var age;

  memfs.stat('/annotatedSnapshot.jpg', function(err, stats) {
    if (stats) {
      age = Date.now() - stats.mtimeMs;
      logger.log("debug", "Annotated snapshot is " + age + "ms old");

      //Only send the annotated snapshot if it's less than 10 seconds old
      if (age < 10000) {
        logger.log("debug", "Serving annotated camera snapshot");
        memfs.createReadStream('/annotatedSnapshot.jpg').pipe(res);
      } else {
        logger.log("debug", "Serving cached camera snapshot");
        memfs.createReadStream('/cameraSnapshot.jpg').pipe(res);
      }
    } else {
      logger.log("debug", "Serving cached camera snapshot");
      memfs.createReadStream('/cameraSnapshot.jpg').pipe(res);
    }
  });
}).listen(8090);

http.createServer(function (req, res) {
  logger.log("debug", "Manually triggering feed processesing.");
  processFeed();
}).listen(9090);

function notifyHomeKit() {
  if (shouldNotify) {
    // Make sure we don't over notify
    shouldNotify = false;

    http.get("http://localhost:8888/", (resp) => {
      resp.on('end', () => {
        logger.log('info', 'Sent HomeKit notification');
      });
    });

    // Do not notify again for another 10 minutes
    setTimeout( function() {
      logger.log('info', 'Resetting HomeKit notification timer');
      shouldNotify = true;
    }, 300000)
  }
}

function captureCameraSnapshot() {
    var file = memfs.createWriteStream('/cameraSnapshot.jpg');

    request
      .get(process.env.CAMERA_SNAPSHOT_URL, { 
        auth: {
          user: process.env.CAMERA_USER,
          pass: process.env.CAMERA_PASS,
          sendImmediately: false
        }
      })
      .on('response', function(response) {
        if (response.statusCode == 401) {
          logger.log('error', "Unauthorized to access camera snapshot API");
        }
      })
      .on('error', function(err) {
        logger.log('error', err);
      })
      .on('end', function() {
        logger.log('debug', "Succesfully updated camera snapshot");
      })
      .pipe(file);
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

function processFeed() {
  
  const cap = new cv.VideoCapture(process.env.CAMERA_STREAM_URL);
  let done = false;

  const interval = setInterval(() => {
    let frame = cap.read();

    if (frame) {
      // Classification expects an encoded image
      jpg = cv.imencode('.jpg', frame);

      classify(jpg, function(results) {
        results['objects'].forEach(function(object) {
          logger.log('debug', "Object recieved: " + JSON.stringify(object));
          updateSnapshot = false;

          if (object.objectClass == 'person') {
            updateSnapshot = true;
            notifyHomeKit();
          }

          if (updateSnapshot) {
            snapshot = Buffer.from(results.annotatedImage.base64Image, 'base64');
            memfs.writeFileSync('/annotatedSnapshot.jpg', snapshot);
          }
        });
      });
    }
  }, 0);

  //Stop processing after 60 seconds
  setTimeout(function() {
    clearInterval(interval)
  }, 60000);
}

function main() {
  var server = new grpc.Server();
  server.addService(worker_proto.Register.service, {register: registerWorker});
  server.bind('[::]:50051', grpc.ServerCredentials.createInsecure());
  server.start();

  // Cache a snapshot from the camera every 5 seconds
  setInterval(captureCameraSnapshot, 10000);

  // Connect to the camera and monitor for motion
  request
    .get(process.env.CAMERA_MOTION_URL, camera_options)
    .on('aborted', function() {
      logger.log('error', "Connection to Camera aborted");
    })
    .on('error', function(err) {
      logger.log('error', err);
    })
    .on('close', function() {
      logger.log('info', "Connection to Camera closed");
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
            processFeed();
          }
        }
      })
    })

}

main();
