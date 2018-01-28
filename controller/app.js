const request = require('request');
const WebSocket = require('ws');
const async = require('async');
const http = require('http');
const fs = require('fs');
const memfs = require('memfs');

var shouldNotify = true
var loglevel = process.env.LOG_LEVEL || 'info';
var cameraSnapshot = null;
var annotatedSnapshot = null;
var snapshotData = null;
var snapshotResetTimer = null;

const snapshotClearTimer = setTimeout(() => {
    snapshot = null;
}, 2000);

//Winston nodejs logger
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const wss = new WebSocket.Server({ port: 8089 });

const logger = createLogger({
  level: loglevel,
  format: combine(
    timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/app/logs/controller-error.log', level: 'error' }),
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

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    processObjects(JSON.parse(message));
  });
});

function resetNotification() {
  logger.log('info', 'Resetting HomeKit notification timer');
  shouldNotify = true;
}

function notifyHomeKit() {
  if (shouldNotify) {
    shouldNotify = false;

    http.get("http://localhost:8888/", (resp) => {
      resp.on('end', () => {
        logger.log('info', 'Notified HomeKit of presence of person');
      });
    });

    // Do not notify again for another 10 minutes
    setTimeout(resetNotification, 300000)
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

function processObjects(data) {
  data['results'].forEach(function(value) {
    logger.log('debug', "Object recieved: " + JSON.stringify(value));
    if (value['class'] == 'person') {
      snapshotData = [ value ];
      snapshot = Buffer.from(data['img'], 'base64');

      var file = memfs.createWriteStream('/annotatedSnapshot.jpg');
      memfs.writeFileSync('/objectSnapshot.jpg', snapshot);

      formData = {
        parameters: JSON.stringify(snapshotData),
        img: memfs.createReadStream('/objectSnapshot.jpg')
      };

      request.post({ url: 'http://localhost:8899/addboxes', formData: formData}, function() {})
      .pipe(file)
      .on('finish', function() {
        logger.log('debug', "Done adding boxes to frame");
        memfs.unlink('/objectSnapshot.jpg', function(err) {
          if (err) {
            logger.log('error', "Unable to delete temporary file objectSnapshot.jpg");
          }
        });
        notifyHomeKit();
      });
    }
  });
}

function sendStatus(runningState) {
  http.get("http://localhost:5000/" + runningState, (resp) => {
    resp.on('end', () => {
      logger.log('info', 'Sent messate to Tensorflow to start object detection');
    })
  })
  .on('error', function(err) {
    logger.log('error', err)
  });

}

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
          sendStatus('start');
        }
      }
    })
  })

// Cache a snapshot from the camera every 5 seconds
setInterval(captureCameraSnapshot, 10000);
