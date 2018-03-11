#!/bin/bash

rm -rf /var/run/dbus
mkdir -p /var/run/dbus
dbus-daemon --system
avahi-daemon -D

node /app/app.js
