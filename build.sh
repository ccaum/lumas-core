#!/bin/bash

docker build -f Dockerfile.opencv -t lumas/lumas-python-opencv:latest .
docker build -f controller/Dockerfile -t lumas/lumas-controller:latest .
docker build -f object-detection/Dockerfile -t lumas/lumas-object-detection:latest .
