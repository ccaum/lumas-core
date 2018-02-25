from models import object_detection
from concurrent import futures
import signal
import grpc
import time
import numpy as np
import cv2
import os
import base64
import logging

import image_classification_pb2_grpc
import image_classification_pb2
import worker_pb2_grpc
import worker_pb2

# Set up logging
logging.basicConfig(filename='/app/logs/classifier.log', level=logging.DEBUG)

#gRPC configs
_GRPC_PORT = 50052

# Load the TensorFlow models into memory
base_path = os.path.dirname(os.path.abspath(__file__))
model_path = base_path + '/faster_rcnn_inception_v2_coco_2017_11_08'
net = object_detection.Net(graph_fp='%s/frozen_inference_graph.pb' % model_path,
    labels_fp='data/label.pbtxt',
    num_classes=90,
    threshold=0.6)

_ONE_DAY_IN_SECONDS = 60 * 60 * 24

def register():
    channel = grpc.insecure_channel('localhost:50051')
    stub = worker_pb2_grpc.RegisterStub(channel)
    grpc_service = worker_pb2.Service(name = "Image")
    grpc_worker = worker_pb2.Worker(grpcAddress = "localhost", grpcPort = str(_GRPC_PORT))
    response = stub.register(grpc_worker)

    if response.successful:
        logging.debug("Successfully registered with contoller.")
        return True
    else:
        logging.error("Could not register worker with Controller. Error is: %s" % response.message)
        return False

class ImageClassification(image_classification_pb2_grpc.ImageClassificationServicer):
    def classify(self, request, context):
	# Settings for annotating image with outlines of detected objects
	font = cv2.FONT_HERSHEY_SIMPLEX
	font_scale = 1
	font_color = (0, 255, 0)
	line_type = 2
	offset = 20

        outline_objects = request.outlineObjects
        classes_to_outline = request.classesToOutline
        base64_image = request.image.base64Image

        # Decode the base64 string
        img = base64.b64decode(base64_image)

        data = np.fromstring(img, dtype=np.uint8)
        decoded_img = cv2.imdecode(data, 1)

        # Perform the classification
        results = net.predict(decoded_img)

        classification = image_classification_pb2.Classification()
        classified_objects = []

        # Build classification objects based on protobuf definition
        for obj in results:
            y1, x1, y2, x2 = obj['bb_o']
            image_size = {'x': obj['img_size'][0], 'y': obj['img_size'][1]}
            score = obj['score']
            label = obj['class']

            classification_object = image_classification_pb2.ClassifiedObject()
            classification_object.boundary.bottomLeft.x = x1
            classification_object.boundary.bottomLeft.y = y1
            classification_object.boundary.bottomLeft.x = x2
            classification_object.boundary.bottomLeft.y = y2
            classification_object.score = score
            classification_object.imageSize.x = image_size['x']
            classification_object.imageSize.y = image_size['y']
            classification_object.objectClass = label
            classified_objects.append(classification_object)

	    # Outline the object if we're supposed to
	    if (outline_objects):

                # Annotate the object if there were no classes to filter on 
                # or if the object is in the list of classes to filter on
                if (classes_to_outline == [] or label in classes_to_outline):
                    cv2.rectangle(decoded_img, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    cv2.putText(decoded_img, label,
                        (x1 + offset, y1 - offset),
                        font,
                        font_scale,
                        font_color,
                        line_type)

        # If we might have annotated the image, encode it and pass it back
        if (outline_objects):
	    retval, img_bytes = cv2.imencode(".jpg", decoded_img)
	    encoded_image = base64.b64encode(img_bytes)
	    classification.annotatedImage.base64Image = encoded_image

        # Add all the classified objets to the gRPC classification message
	classification.objects.extend(classified_objects)

        # Register with the controller that we're ready for more work
        register()

        ## Return Classification message defined in protobuf
        return classification
        

if __name__ == '__main__':
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    image_classification_pb2_grpc.add_ImageClassificationServicer_to_server(ImageClassification(), server)
    server.add_insecure_port('[::]:50052')
    server.start()

    # Register with the controller that we're ready for work
    registration_successful = False
    while registration_successful == False:
        registration_successful = register()

    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except signal.SIGHUP:
        server.stop(0)
