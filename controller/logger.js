//Winston nodejs logger
const moment = require('moment-timezone');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

loglevel = process.env.LOG_LEVEL;
timezone = process.env.TZ;

const appendTimestamp = format((info, opts) => {
  if(opts.tz)
    info.timestamp = moment().tz(opts.tz).format();
  return info;
});

const logger = createLogger({
  level: loglevel,
  format: combine(
    appendTimestamp({ tz: timezone }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: '/app/logs/controller.log',
    })
  ]
});

module.exports = logger;
