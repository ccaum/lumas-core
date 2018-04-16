FROM tensorflow/tensorflow:latest

RUN mkdir /app
WORKDIR /app

# Install the TF pre-trained model
RUN curl -O  http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    tar -xvzf faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    rm faster_rcnn_inception_v2_coco_2017_11_08.tar.gz

# Make sure we're running the latest version of pip
RUN python -m pip install --upgrade pip
RUN python -m pip install grpcio grpcio-tools

COPY object-detection/ /app/
COPY ./protos /protos

RUN python -m pip install grpcio
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/image_classification.proto
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/worker.proto

CMD python -u /app/app.py
