FROM node:latest

RUN mkdir /app
WORKDIR /app
RUN npm install ws && npm install request
COPY app.js /app/
COPY node_modules /app/node_modules

CMD node /app/app.js
