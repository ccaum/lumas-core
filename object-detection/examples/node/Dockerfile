FROM node

ENV REPO_ROOT grpc

RUN apt-get update

COPY ./protos /protos

RUN mkdir /app
WORKDIR /app/
COPY . /app/

RUN npm install
