//Winston nodejs logger
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

loglevel = process.env.LOG_LEVEL;

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

module.exports = logger;
