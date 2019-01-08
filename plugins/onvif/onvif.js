const EventEmitter = require("events").EventEmitter;
const fp = require("find-free-port")
const util = require('util')
const logger = require('./logger.js').logger;
const retry = require('retry');
const spawn = require('child_process').spawn;
const ffmpeg = require('fluent-ffmpeg');
const memfs = require('memfs');
const pipe2jpeg = require('pipe2jpeg');

module.exports = { ONVIF };

function ONVIF(config) {
  this.rtspURL = config.rtspStream;
}

util.inherits(ONVIF, EventEmitter);

ONVIF.prototype.processFeed = function() {
  const self = this;

  //Find a free port to stream on
  fp(40160, 40199, '0.0.0.0', function(err, streamPort) {
    if (err) {
      logger.log('error', 'Could not find a free port to stream RTSP');
      return;
    }

    const p2j = new pipe2jpeg();

    p2j.on('jpeg', (jpeg) => {
      self.emit('frame', jpeg);
    });

    let ffmpegParams = ['-re', '-rtsp_transport', 'tcp',
      '-i', self.rtspURL,
      '-map', '0:0',
      '-pix_fmt', 'yuv420p',
      '-f', 'rawvideo', '-tune', 'zerolatency',
      '-vf', 'scale=1280:720',
      '-strict', '-2',
      '-c:v', 'mjpeg',
      '-q:v', '3',
      '-tune', 'zerolatency',
      '-f', 'image2pipe', 
      '-']
    logger.log('debug', "Running ffmpeg with parameters: " + ffmpegParams);

    let ffmpegsh = spawn('ffmpeg', ffmpegParams)
    ffmpegsh.stdout.pipe(p2j);

    ffmpegsh.stderr.on('data', function(out) {
      logger.log('debug', 'FFMPEG stderr: ' + out.toString('utf8'));
    });
    ffmpegsh.on('exit', function() {
      logger.log('debug', 'ffmpeg closed');
    });
  });
}

ONVIF.prototype.getSnapshot = function() {
  const file = this.frameDirectory + '/snapshot.jpg';

  fs.readFile(file, function(err, buf) {
    if (err) {
      logger.log("error", "Could not read " + file + " from fs: " + err.message);
    }

    callback(buf);
  });
}
