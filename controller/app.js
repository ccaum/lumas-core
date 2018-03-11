const { startController, events } = require('./controller.js');
const logger = require('./logger.js');

var controller;
var conditions = [];
var plugins = [];

function main() {
  startController();
}

main();
