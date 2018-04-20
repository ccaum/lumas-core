FROM lumas/lumas-python-opencv

# Make sure we're running the latest version of pip
RUN python -m pip install --upgrade pip && \
    python -m pip install tensorflow grpcio grpcio-tools && \
    apt-get update && apt-get install -y curl tar && \
    mkdir /app

WORKDIR /app

# Install the TF pre-trained model
RUN curl -O  http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    tar -xvzf faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    rm faster_rcnn_inception_v2_coco_2017_11_08.tar.gz

COPY object-detection/ /app/
COPY ./protos /protos

RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/image_classification.proto && \
    python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/worker.proto

CMD python -u /app/app.py
