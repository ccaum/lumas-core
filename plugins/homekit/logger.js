//Winston nodejs logger
const moment = require('moment-timezone');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

loglevel = "debug"
timezone = "Europe/London"

const appendTimestamp = format((info, opts) => {
  if(opts.tz)
    info.timestamp = moment().tz(opts.tz).format();
  return info;
});

function config(configHash) {
  if (configHash.loglevel) {
    loglevel = configHash.loglevel;
  } else {
    loglevel = 'info'
  }

  if (configHash.timezone) {
    timezone = configHash.timezone
  }
}

const logger = createLogger({
  level: loglevel,
  format: combine(
    appendTimestamp({ tz: timezone }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: '/app/logs/onvif.log',
    })
  ]
});

module.exports = {logger, config};
