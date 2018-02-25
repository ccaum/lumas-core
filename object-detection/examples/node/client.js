var PROTO_DIR;

var fs = require('fs');

if (fs.existsSync('/protos')) {
  PROTO_DIR = '/protos';
} else {
  PROTO_DIR = __dirname + '/../../protos';
}

var proto_file = PROTO_DIR + '/image_classification.proto';
var grpc = require('grpc');
var image_classification_proto = grpc.load(proto_file).classification;

function main() {
  var client = new image_classification_proto.ImageClassification('localhost:50051',
                                             grpc.credentials.createInsecure());

  fs.readFile('people.jpeg', function read(err, data) {
    if (err) {
      console.log(err);
    }

    var imageToBeClassified = {
      image: {
        base64Image: new Buffer(data).toString('base64'),
      }
    }

    client.classify(imageToBeClassified, function(err, objects) { 
      console.log(objects);
    });
  });
}

main();
