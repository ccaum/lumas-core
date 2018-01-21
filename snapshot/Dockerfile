FROM valian/docker-python-opencv-ffmpeg

RUN pip install Flask

RUN mkdir /app
WORKDIR /app/
COPY . /app/

CMD python /app/app.py
