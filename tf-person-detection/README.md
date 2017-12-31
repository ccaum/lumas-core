# Introduction

This is a repo for implementing object detection with pre-trained models (as shown below) on tensorflow.

| Model # | Model name  | Speed | COCO mAP | Outputs |
| ------------ | :----------: | :--------------: | :--------------: | :-------------: |
| 1 | [ssd_mobilenet_v1_coco](http://download.tensorflow.org/models/object_detection/ssd_mobilenet_v1_coco_11_06_2017.tar.gz) | fast | 21 | Boxes |
| 2 | [ssd_inception_v2_coco](http://download.tensorflow.org/models/object_detection/ssd_inception_v2_coco_11_06_2017.tar.gz) | fast | 24 | Boxes |
| 3 | [rfcn_resnet101_coco](http://download.tensorflow.org/models/object_detection/rfcn_resnet101_coco_11_06_2017.tar.gz)  | medium | 30 | Boxes |
| 4 | [faster_rcnn_resnet101_coco](http://download.tensorflow.org/models/object_detection/faster_rcnn_resnet101_coco_11_06_2017.tar.gz) | medium | 32 | Boxes |
| 5 | [faster_rcnn_inception_resnet_v2_atrous_coco](http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_resnet_v2_atrous_coco_11_06_2017.tar.gz) | slow | 37 | Boxes |
| 6 | [faster_rcnn_inception_v2_coco_2017_11_08](http://download.tensorflow.org/models/object_detection/faster_rcnn_inception_v4_coco_2017_11_08.tar.gz) | medium | 32 | Boxes |


# Run Demo

`docker run -it --privileged -e DISPLAY=[X11 server IP]:0 -v /tmp/.X11-unix:/tmp/.X11-unix -e STREAM_URL=[URL_OF_VIDEO_STREAM] -e TENSORFLOW_MODEL=[MODEL_#] ccaum/camera-person-detector`


The TENSORFLOW_MODEL environment variables should be set to one of the models in the model table above. Each one performs differently. The slower ones detect the best, but have more trouble keeping up with the stream.
The default model is #6.

## On a Mac

First install [XQuartz](https://www.xquartz.org). Then run...

```
xhost + [You Mac's IP Address (not the loopback)]
```

Then run the Docker command above.

# Example with IP Camera

`docker run -it --privileged -e DISPLAY=192.168.2.25:0 -v /tmp/.X11-unix:/tmp/.X11-unix -e STREAM_URL=rtsp://username:password@ip.camera.address -e TENSORFLOW_MODEL=6`
