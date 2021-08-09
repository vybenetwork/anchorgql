#!/usr/bin/env bash

node builder.js 
cd server
npm install
node index.js
