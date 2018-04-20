Lumas enables person detection and HomeKit support to off the shelf IP camera.

![HomeKit notification](images/notification.jpg)

Currently it only support Amcrest IP cameras, but more camera support is coming.
Presently it also only supports one camera at a time.

## Setup

### Requirements

**Software Requirements:** 
* Docker (CE or EE)

**Hardware Requirements:**
* Architecture: x86_64

### Configuring Lumas

1) Copy the docker-compose.yml file from this repo to the machine where you want to run Lumas
2) Modify the parameters in the docker-compose.yml file for your camera

**docker-compose.yml parameters**

* CAMERA_STREAM_URL - The rtsp URL to your camera's stream (e.g. rtsp://admin:adminpass@192.168.2.43)
* CAMERA_MOTION_URL - The motion API endpoint to monitor for motion. Motion activates the stream processing.
* CAMERA_SNAPSHOT_URL - If your camera supports it, the URL endpoint to get a snapshot from the camera
* CAMERA_ADDRESS - The IP or hostname of the camera
* CAMERA_USER - The username to authenticate to the camera with
* CAMERA_PASS - The password to authenticate to the camera with 
* HOMEKIT_CODE - The HomeKit code to use. (e.g. 431-48-159) 
* LOG_LEVEL - Options are ['info','warn','error','debug']. Default is 'info'
* TZ - The timezone you're in. Full list [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). Default is GMT+0

### Logs

You can mount any directory to the /app/logs directory in the containers. The easiest thing to do get started is create a directory in the current working directory with `mkdir logs`. That will fill up fast as the application doesn't rotate logs, so you'll probably want to move that to a better location.

### Running

Run the application with `docker-compose up -d`

### Setting up HomeKit

#### 1) Open the Home app on iOS.

#### 2) Click the '+' symbol and select "Add Accessory"
![Add accessory](images/add_accessory.jpg)

#### 3) On the 'Add Accessory' page, select "Don't have a code or Can't scan?"
![Add accessory](images/select_enter_code.jpg)

#### 4) In the Nearby Accessories section, select "Lumas Camera"
![Add accessory](images/lumas_camera_homekit.jpg)


## Roadmap

* Multi-camera support
* More camera support, including any ONVIF compatible camera
* Face recognition - Learn familiar faces over time with custom alerts
* Time lapse - See what's been happening through the day
