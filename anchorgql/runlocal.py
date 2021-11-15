import json
import subprocess

f = open('config.json')
config = json.load(f)

subprocess.run("npm install && node builder.js",shell=True)
subprocess.run("npm install && npm start", cwd="channel_"+config['PROJECT_NAME'],shell=True)

