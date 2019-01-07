from concurrent import futures
import signal
import grpc
import time
import numpy as np
import cv2
import os
import base64
import logging
import imutils
import base64

import plugin_pb2_grpc
import plugin_pb2
import motion_pb2_grpc
import motion_pb2

# Set up logging
logging.basicConfig(filename='/app/logs/motion.log', level=logging.DEBUG)

#gRPC configs
_GRPC_PORT = 6123

_ONE_DAY_IN_SECONDS = 60 * 60 * 24

def register():
    protobuf = open("/protos/motion.proto", "r").read()
    channel = grpc.insecure_channel('localhost:50061')
    stub = plugin_pb2_grpc.RegisterStub(channel)

    plugin_services = []
    plugin_services.append(plugin_pb2.PluginService(type = "Motion", configProtobuf = protobuf))
    grpc_service = plugin_pb2.PluginRegistration()
    grpc_service.name = "Motion"
    grpc_service.grpcPort = _GRPC_PORT
    grpc_service.grpcAddress = "localhost"
    grpc_service.pluginServices.extend(plugin_services)

    response = stub.register(grpc_service)

    if response.successful:
        logging.info("Successfully registered with contoller.")
        return True
    else:
        logging.error("Could not register worker with Controller. Error is: %s" % response.message)
        return False

class Motion(motion_pb2_grpc.MotionServicer):
    def compareFrames(self, frame1, frame2):
        motionAreas = []
        motionDetected = False

        # compute the absolute difference between the current frame and
        # first frame
        frameDelta = cv2.absdiff(frame1, frame2)
        thresh = cv2.threshold(frameDelta, 3, 255, cv2.THRESH_BINARY)[1]

        # dilate the thresholded image to fill in holes, then find contours
        # on thresholded image
        thresh = cv2.dilate(thresh, None, iterations=2)
        cnts = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL,
          cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if imutils.is_cv2() else cnts[1]

        # loop over the contours
        for c in cnts:
            # if the contour is too small, ignore it
            if cv2.contourArea(c) < 3000:
                continue

            # If there's a contour of sufficient size, we have detected motion
            motionDetected = True

            # compute the bounding box for the contour, draw it on the frame,
            # and update the text
            (x, y, width, height) = cv2.boundingRect(c)
            motionArea = motion_pb2.MotionArea()
            motionArea.x = x
            motionArea.y = y
            motionArea.width = width
            motionArea.height = height
            motionAreas.append(motionArea)

        return {"motion": motionDetected, "motionAreas": motionAreas}

    def base64ImageToMat(self, img):
        img = base64.b64decode(img)
        data = np.fromstring(img, dtype=np.uint8)
        decoded_img = cv2.imdecode(data, 1)

        return decoded_img

    def detectMotion(self, request, context):
        frame1 = self.base64ImageToMat(request.firstImage.base64Image)
        frame2 = self.base64ImageToMat(request.secondImage.base64Image)

        results = compareFrames(frame1, frame2)

        results_object = motion_pb2.MotionResults()
        results_object.motion = results['motion']
        results_object.motionAreas.extend(results['motionAreas'])

        return results_object

    def detectMotionStream(self, request_iterator, context):
        prevFrame = None

        for image in request_iterator:
            frame = self.base64ImageToMat(image.base64Image)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frame = cv2.GaussianBlur(frame, (21, 21), 0)

            if prevFrame is None:
                prevFrame = frame
                next

            results = self.compareFrames(prevFrame, frame)

            # Set the previous frame to the current frame
            prevFrame = frame

            results_object = motion_pb2.MotionResults()
            results_object.motionDetected = results['motion']
            results_object.motionAreas.extend(results['motionAreas'])

            yield results_object

if __name__ == '__main__':
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    motion_pb2_grpc.add_MotionServicer_to_server(Motion(), server)
    server.add_insecure_port('[::]:' + str(_GRPC_PORT))
    server.start()

    # Register with the controller that we're ready for work
    registration_successful = False
    while registration_successful == False:
        try:
            registration_successful = register()
        except:
            logging.error("Could not register with Controller. Trying again in 3 seconds")
            time.sleep(3)

    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except signal.SIGHUP:
        server.stop(0)
