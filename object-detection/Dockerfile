FROM ccaum/athena-python-opencv

ARG TF_BRANCH=v1.6.0
ARG WHL_DIR=/whl

RUN apt-get update && apt-get -y install python-pip git openjdk-8-jdk curl

# Make sure we're running the latest version of pip
RUN python -m pip install --upgrade pip

# Install bazel for Tensorflow build
RUN echo "deb [arch=amd64] http://storage.googleapis.com/bazel-apt stable jdk1.8" | tee /etc/apt/sources.list.d/bazel.list && \
    curl https://bazel.build/bazel-release.pub.gpg | apt-key add - && \
    apt-get update && apt-get install bazel -y

# Install Tensorflow# Download and build TensorFlow.
WORKDIR /
RUN rm -rf tensorflow && \
    git clone https://github.com/tensorflow/tensorflow.git && \
    cd tensorflow && \
    git checkout ${TF_BRANCH}
WORKDIR /tensorflow

# Configure the build for CPU with MKL by accepting default build options and
# setting library locations
ENV CI_BUILD_PYTHON=python \
   LD_LIBRARY_PATH=${LD_LIBRARY_PATH} \
    PYTHON_BIN_PATH=/usr/bin/python \
    PYTHON_LIB_PATH=/usr/local/lib/python2.7/dist-packages \
    CC_OPT_FLAGS='-march=native' \
    TF_NEED_JEMALLOC=0 \
    TF_NEED_GCP=0 \
    TF_NEED_CUDA=0 \
    TF_NEED_HDFS=0 \
    TF_NEED_S3=0 \
    TF_NEED_OPENCL=0 \
    TF_NEED_GDR=0 \
    TF_ENABLE_XLA=0 \
    TF_NEED_VERBS=0 \
    TF_NEED_MPI=0
RUN ./configure

# Build and Install TensorFlow.
# The 'mkl' option builds with Intel(R) Math Kernel Library (MKL), which detects
# the platform it is currently running on and takes appropriately optimized 
# paths. The -march=native option is for code that is not in MKL, and assumes
# this container will be run on the same architecture on which it is built.
RUN LD_LIBRARY_PATH=${LD_LIBRARY_PATH} \
    bazel build --config=mkl \
                --config="opt" \
                --copt="-march=broadwell" \
                --copt="-O3" \
                //tensorflow/tools/pip_package:build_pip_package && \
    mkdir ${WHL_DIR} && \
    bazel-bin/tensorflow/tools/pip_package/build_pip_package ${WHL_DIR}

# Clean up Bazel cache when done, but leave the whl.
# This will upgrade the default Tensorflow version with the Intel MKL version
RUN pip --no-cache-dir install --upgrade ${WHL_DIR}/tensorflow-*.whl && \
    rm -rf /root/.cache

# Install and gRPC
RUN pip install grpcio && \
    pip install grpcio-tools

RUN mkdir /app
WORKDIR /app/
COPY  object-detection/ /app/

COPY ./protos /protos
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/image_classification.proto
RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/worker.proto

# Install the TF pre-trained model
RUN apt-get install -y curl tar git && \
    curl -O  http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    tar -xvzf faster_rcnn_inception_v2_coco_2017_11_08.tar.gz && \
    rm faster_rcnn_inception_v2_coco_2017_11_08.tar.gz

CMD python -u /app/app.py
