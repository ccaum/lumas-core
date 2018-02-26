#!/bin/bash

docker build -f Dockerfile.opencv -t ccaum/athena-python-opencv:latest .
docker build -f controller/Dockerfile -t ccaum/athena-controller:latest .
docker build -f controller/object-detection -t ccaum/athena-object-detection:latest .
