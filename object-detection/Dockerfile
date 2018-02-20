FROM ccaum/athena-python-opencv

RUN apt-get update && apt-get -y install python-pip
RUN pip install tensorflow && pip install websocket-client && pip install Flask

RUN mkdir /app
WORKDIR /app/
COPY . /app/

RUN apt-get update || true

RUN apt-get install -y curl tar git && \
    curl -O  http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    tar -xvzf faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    rm faster_rcnn_inception_v2_coco_2017_11_08.tar.gz

CMD python /app/app.py
