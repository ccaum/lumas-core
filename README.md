Lumas enables person detection and HomeKit support to off the shelf IP camera.

![HomeKit notification](notification.jpg)

Currently it only support Amcrest IP cameras, but more camera support is coming.
Presently it also only supports one camera at a time.

## Setup

### Requirements

**Software Requirements:** 
* Docker (CE or EE)

**Hardware Requirements:**
* Architecture: x86_64

### Configuring

1) Copy the docker-compose.yml file from this repo to the machine where you want to run Lumas
2) Modify the parameters in the docker-compose.yml file for your camera

**docker-compose.yml parameters**

* CAMERA_STREAM_URL - The rtsp URL to your camera's stream (e.g. rtsp://admin:adminpass@192.168.2.43)
* CAMERA_MOTION_URL - The motion API endpoint to monitor for motion. Motion activates the stream processing.
* CAMERA_SNAPSHOT_URL - If your camera supports it, the URL endpoint to get a snapshot from the camera
* CAMERA_ADDRESS - The IP or hostname of the camera
* CAMERA_USER - The username to authenticate to the camera with
* CAMERA_PASS - The password to authenticate to the camera with 
* LOG_LEVEL - Options are ['info','warn','error','debug']. Default is 'info'
* TZ - The timezone you're in. Full list [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). Default is GMT+0

## Roadmap

* Face recognition - Learn familiar faces over time with custom alerts
* Time lapse - View notifications in time
