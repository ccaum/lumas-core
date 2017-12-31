from models import object_detection
from threading import Thread
from lomond import WebSocket
from lomond.persist import persist
import cv2
import sys
import os
import json
import os

frame = None
ret = None
process_feed = False
camera_open = False

base_path = os.path.dirname(os.path.abspath(__file__))
model_path = base_path + '/faster_rcnn_inception_v2_coco_2017_11_08'
net = object_detection.Net(graph_fp='%s/frozen_inference_graph.pb' % model_path,
    labels_fp='data/label.pbtxt',
    num_classes=90,
    threshold=0.6)

def on_message(ws, message):
    if message == 'start':
        process_feed = True

        camerathread.start()
        tfthread.start()
        camerathread.join()
        tfthread.join()

    if message == 'stop':
        process_feed = False

def on_close(ws):
    print("Closing websocket")

def on_error(ws, error):
    print("ERROR: " + error)

def tf():

    while True:
        if not process_feed:
            break

        if not camera_open:
            next

        if ret:
            resize_frame = cv2.resize(frame, (720, 480))
            results = net.predict(img=resize_frame, display_img=resize_frame)
            json_string = json.dumps(results)
            ws.send(json_string)

    sys.exit(0)


def camera():
    global camera_open
    global frame
    global ret

    video_location = os.getenv('STREAM_URL')
    cap = cv2.VideoCapture(video_location)

    while True:
        if not process_feed:
            break

        ret, frame = cap.read()

    camera_open = False
    sys.exit(0)

if __name__ == '__main__':
    ws = WebSocket("ws://monitor:8080/websocket")
    for event in persist(ws):
        if event.name == 'text':
            if event.text == 'start':
                process_feed = True

                camerathread.start()
                tfthread.start()
                camerathread.join()
                tfthread.join()

            if message == 'stop':
                process_feed = False
