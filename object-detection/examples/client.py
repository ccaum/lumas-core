from __future__ import print_function
import base64

import grpc

import image_classification_pb2_grpc
import image_classification_pb2

def run():
    image = open('people.jpeg', 'rb').read()
    encoded_image = base64.b64encode(image)
    
    channel = grpc.insecure_channel('localhost:50051')
    stub = image_classification_pb2_grpc.ImageClassificationStub(channel)
    grpc_image = image_classification_pb2.Image(base64Image = encoded_image)
    response = stub.classify(image_classification_pb2.ImageToBeClassified(image = grpc_image, outlineObjects = True, classesToOutline = ['person'] ))
    
    decoded_img = base64.b64decode(response.annotatedImage.base64Image)
    open('output.jpg', 'wb').write(decoded_img)

    for obj in response.objects:
      print ("Object: " + obj.objectClass)
      print ("Score: " + str(obj.score))
      print ("\n")


if __name__ == '__main__':
    run()
