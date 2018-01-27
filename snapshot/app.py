from flask import Flask, request, send_file
import json
import sys
import io
import numpy as np
import base64
import cv2
import uuid
import logging


# Create the API endpoints
app = Flask(__name__)
app.logger.addHandler(logging.StreamHandler(sys.stdout))
app.logger.setLevel(logging.DEBUG)

@app.route('/addboxes', methods = ['POST'])
def addBoxes():
    objects = json.loads(request.form['parameters'])
    img = request.files['img']


    in_memory_file = io.BytesIO()
    img.save(in_memory_file)
    data = np.fromstring(in_memory_file.getvalue(), dtype=np.uint8)

    decoded_img = cv2.imdecode(data, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    font_color = (0, 255, 0)
    line_type = 2
    offset = 20

    for obj in objects:
        label = obj['class']
        y1, x1, y2, x2 = obj['bb_o']
        score = obj['score']

        cv2.rectangle(decoded_img, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.putText(decoded_img, label,
                    (x1 + offset, y1 - offset),
                    font,
                    font_scale,
                    font_color,
                    line_type)

    retval, img_bytes = cv2.imencode(".jpg", decoded_img)

    return send_file(io.BytesIO(img_bytes), attachment_filename='img.jpg', mimetype='image/jpeg')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8899)
