const request = require('request');
const WebSocket = require('ws');

//Winston nodejs logger
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const wss = new WebSocket.Server({ port: 8089 });

var http = require('http');
var shouldNotify = true
var loglevel = process.env.LOG_LEVEL || 'info';

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

const options = {
  auth: {
    user: process.env.CAMERA_USER,
    pass: process.env.CAMERA_PASS,
    sendImmediately: false
  },
  forever: true
};

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    logger.log('debug', 'Objects received: ' + message);
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
        console.log("Notified HomeKit of presence of person");
      });
    });

    // Do not notify again for another 10 minutes
    setTimeout(resetNotification, 300000)
  }
}

function processObjects(objects) {
  objects.forEach(function(value) {
    if (value['class'] == 'person') {
      notifyHomeKit();
    }
  });
}

function sendStatus(runningState) {
  http.get("http://localhost:5000/" + runningState, (resp) => {
    resp.on('end', () => {
      logger.log('info', 'Sent messate to Tensorflow to start object detection');
    });
  });
}

request
  .get(process.env.CAMERA_MOTION_URL, options)
  .on('aborted', function() {
    logger.log('error', "Connection to Camera aborted");
  })
  .on('error', function(err) {
    logger.log('error', err);
  })
  .on('close', function() {
    logger.log('info', "Connection to Camera closed");
  .on('response', function(res) {
    code = null;
    action = null;
    index = null;


    res.on('data', function (body) {
      data = body.toString('utf8');

      logger.log('debug', 'Receeived response from camera API' + data);

      if (data.substring(0,2) == '--') {
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
