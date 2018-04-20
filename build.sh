#!/bin/bash

docker build --network host -f Dockerfile.opencv --no-cache -t lumas/lumas-python-opencv:latest .
docker build --network host -f controller/Dockerfile --no-cache -t lumas/lumas-controller:latest .
docker build --network host -f object-detection/Dockerfile --no-cache -t lumas/lumas-object-detection:latest .
