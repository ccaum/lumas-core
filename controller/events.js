const uuidv4 = require('uuid/v4');
const Sequelize = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  storage: '/storage/db.sqlite'
});

const Event = sequelize.define('events', {
  id: {
    type: Sequelize.INTEGER, 
    primaryKey: true, 
    autoIncrement: true, 
    unsigned: true
  },

  tenantID: {
    type: Sequelize.INTEGER
  },

  type: {
    type: Sequelize.STRING
  },

  cameraID: {
    type: Sequelize.INTEGER
  },

  frameID: {
    type: Sequelize.STRING
  },

  parameters: {
    type: Sequelize.JSON
  }
});

Event.sync();

function saveImage(img, callback) {
  uuid = uuidv4();

  fs.exists('/storage/images', (exists) => {
    if (!exists) {
      fs.mkdirSync('/storage/images');
    }

    fs.writeFile('/storage/images/' + uuid + '.jpg', img, (err) => {
      if (err) {
        callback(err, null);
      }

      callback(null, uuid);
    });
  });
}

module.exports = {
  Event: Event,
  saveImage: saveImage
}
