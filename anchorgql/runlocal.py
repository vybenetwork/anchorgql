import json
import subprocess

f = open('./src/config.json')
config = json.load(f)

subprocess.run("npm install && npm start",shell=True)
subprocess.run("npm install && npm start", cwd="./src/channel_"+config['projectName'],shell=True)

