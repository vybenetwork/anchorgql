# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM node:14

RUN npm install --production

COPY . ./
COPY id.json /root/.config/solana/id.json 
COPY id.json /home/.config/solana/id.json 

RUN npm start