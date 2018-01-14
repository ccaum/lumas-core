FROM node:latest

RUN mkdir /app
WORKDIR /app
RUN npm install ws && npm install request
COPY app.js /app/
COPY package.json /app/package.json
RUN yarn

CMD node /app/app.js
