FROM ccaum/athena-python-opencv

RUN apt-get update && apt-get -y install python-pip

# Make sure we're running the latest version of pip
RUN python -m pip install --upgrade pip

# Install Tensorflow and gRPC
RUN pip install tensorflow && \
    pip install grpcio && \
    pip install grpcio-tools

RUN mkdir /app
WORKDIR /app/
COPY . /app/

COPY ./protos /protos
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/image_classification.proto
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/worker.proto

# Install the TF pre-trained model
RUN apt-get install -y curl tar git && \
    curl -O  http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    tar -xvzf faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    rm faster_rcnn_inception_v2_coco_2017_11_08.tar.gz

CMD python -u /app/app.py
