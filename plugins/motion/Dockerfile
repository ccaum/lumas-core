FROM lumas/lumas-python-opencv

# Make sure we're running the latest version of pip
RUN python -m pip install --upgrade pip && \
    python -m pip install grpcio grpcio-tools imutils && \
    mkdir /app

WORKDIR /app


COPY ./ /app/
COPY ./protos /protos

RUN python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/motion.proto && \
    python -m grpc_tools.protoc -I /protos --python_out=/app/ --grpc_python_out=/app/ /protos/plugin.proto

CMD python -u /app/app.py
