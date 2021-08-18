#!/usr/bin/env bash

npm install
node builder.js 
cd server
npm install
node index.js
