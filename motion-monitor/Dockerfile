FROM node:latest

RUN mkdir /app
WORKDIR /app
RUN npm install ws && npm install request
COPY app.js /app/

CMD node /app/app.js
