from models import object_detection
from threading import Thread
from flask import Flask, request
import websocket
import thread
import time
import cv2
import sys
import os
import json
import os
import sys
import base64

# Global variables shared between threads
frame = None
ret = None
process_feed = False
camera_open = False
timer = None

# Load the TensorFlow models into memory
base_path = os.path.dirname(os.path.abspath(__file__))
model_path = base_path + '/faster_rcnn_inception_v2_coco_2017_11_08'
net = object_detection.Net(graph_fp='%s/frozen_inference_graph.pb' % model_path,
    labels_fp='data/label.pbtxt',
    num_classes=90,
    threshold=0.6)

# Create the API endpoints
app = Flask(__name__)

def stopwatch():
    global process_feed
    global timer

    seconds = time.time() - timer

    while seconds <= 60:
        time.sleep(1)
        seconds = time.time() - timer

    # Tell the TF thread to stop
    #event.set()

    process_feed = False
    timer = None

@app.route('/start')
def start():
    global timer
    global process_feed

    #objects = request.args.get('objects')
    #objects = objects.split(',')

    #e = threading.Event()

    # There must not be threads running if timer == None
    if timer == None:
        timer = time.time()
        stopwatchthread = Thread(target=stopwatch)
        stopwatchthread.start()

    #tfthread = Thread(target=tf, args=[e,objects])
    #tfthread.start()

    process_feed = True
    return "OK"

def tf():
    #while not e.isSet():
    while True:
        if camera_open:
            if ret:
                resize_frame = cv2.resize(frame, (720, 480))
                results = net.predict(resize_frame)
                jpg = cv2.imencode('.jpg', frame)[1]
                encoded_frame = base64.b64encode(jpg)

                results_hash = {
                  'results': results,
                  'img':     encoded_frame
                }

                json_string = json.dumps(results_hash)

                ws.send(json_string)
        else:
            time.sleep(0.1)

def camera():
    global camera_open
    global frame
    global ret
    cap = None

    while True:
        if process_feed:
            video_location = os.getenv('STREAM_URL')

            if cap == None:
                try:
                    cap = cv2.VideoCapture(video_location)
                except:
                    sys.stderr.write("Could not open camera feed.\n")
                    camera_open = False

            ret, frame = cap.read()
            camera_open = True
        else:
            if cap:
                cap.release()
                cap = None
            camera_open = False
            time.sleep(0.1)

def socket():
    global ws

    while True:
        try:
            websocket.enableTrace(False)
            ws = websocket.WebSocketApp("ws://localhost:8089/")
            ws.run_forever()
        except Exception as err:
            sys.stderr.write("Could not connect to websocket: " + str(err) + ". Trying again in 1 second\n")
            time.sleep(1)

def webapp():
    app.run(host='0.0.0.0')

if __name__ == '__main__':
    sys.stderr.write("Starting threads\n")
    camerathread = Thread(target=camera)
    camerathread.start()

    tfthread = Thread(target=tf)
    tfthread.start()

    webthread = Thread(target=webapp)
    webthread.start()
    wsthread = Thread(target=socket)
    wsthread.start()

    wsthread.join()
    tfthread.join()
    camerathread.join()
    webthread.join()

    ws.close()
