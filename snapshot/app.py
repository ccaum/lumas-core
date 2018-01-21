from flask import Flask, request
import json
import sys
import io
import numpy as np
import base64
import cv2
import uuid

# Create the API endpoints
app = Flask(__name__)

@app.route('/addboxes', methods = ['POST'])
def addBoxes():
    photo = request.files['img']
    in_memory_file = io.BytesIO()
    photo.save(in_memory_file)
    data = np.fromstring(in_memory_file.getvalue(), dtype=np.uint8)
    img = cv2.imdecode(data, 1)

    parameters = json.loads(request.form['parameters'])
    objects = parameters['objects']

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    font_color = (0, 255, 0)
    line_type = 2
    offset = 20

    for obj in objects:
        label = obj['class']
        y1, x1, y2, x2 = obj['bb_o']
        score = obj['score']

        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.putText(img, label,
                    (x1 + offset, y1 - offset),
                    font,
                    font_scale,
                    font_color,
                    line_type)

    retval, img_bytes = cv2.imencode(".jpg", img)
    byte_string = img_bytes.tostring()

    return byte_string

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8899)
