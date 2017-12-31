const request = require('request');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

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
    obj = JSON.parse(message);
    console.log("GOT JSON: " + obj.stringify);
  });
});

request
  .get(process.env.CAMERA_MOTION_URL, options)
  .on('error', function(err) {
    console.log(err)
  })
  .on('response', function(res) {
    code = null;
    action = null;
    index = null;

    res.on('data', function (body) {
      console.log("BODY: " + body);
      data = body.toString('utf8');

      if (data.substring(0,2) == '--') {
        lines = data.split('\r\n')

        codeString = lines[3].split(';')[0]
        actionString = lines[3].split(';')[1]
        indexString = lines[3].split(';')[2]

        code = codeString.split('=')[1]
        action = actionString.split('=')[1]
        index = indexString.split('=')[1]

        if (action == 'Start') {
          wss.broadcast = function broadcast(data) {
            wss.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send('start');
              }
            });
          };
        } else if (action == 'Stop') {
          wss.broadcast = function broadcast(data) {
            wss.clients.forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                client.send('stop');
              }
            });
          };
        }
      }
    })
  })
