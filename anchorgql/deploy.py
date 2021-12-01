import json
import subprocess
import shutil
import os
import asyncio
import requests

from solana.rpc.async_api import AsyncClient
from solana.publickey import PublicKey
from anchorpy import Program, Provider, Wallet

from runlocal import build_and_start_server, create_project_config, bcolors


async def acquire_idl_for_program(pid, project_name):
    client = AsyncClient("https://api.mainnet-beta.solana.com/")
    provider = Provider(client, Wallet.local())
    # load the Serum Swap Program (not the Serum dex itself).
    program_id = PublicKey(pid)
    idl = await Program.fetch_raw_idl(
        program_id, provider
    )
    with open(f'./src/idls/{project_name}.json', 'w') as file:
        file.write(idl)
    return


def addHasuraRemoteSchema(schema_url, project_name):
    url = "https://devoted-airedale-95.hasura.app/v1/metadata"
    payload = """
    {
        "type":"add_remote_schema",
        "args": {
        "name": "__NAME__",
        "definition": {
            "url": "__SCHEMAURL__",
            "headers": [{"name": "X-Server-Request-From", "value": "Hasura"}],
            "forward_client_headers": false,
            "timeout_seconds": 60
            },
            "comment": "some optional comment"
        }
    }"""
    payload = payload.replace("__NAME__", project_name).replace(
        "__SCHEMAURL__", (schema_url+"/graphql"))
    headers = {
        'x-hasura-admin-secret': os.environ.get("api-token"),
    }
    response = requests.request("POST", url, headers=headers, data=payload)
    if response.status_code != 200:
        print(
            f'{bcolors.FAIL}ERROR: Failed to add remote schema for project: {project_name}{bcolors.ENDC}')
        subprocess.Popen(['rm', '-rf', './src/server'])
        return False
    return True

# return [url] where url is a string for the path to the project if the project was deployed and None otherwise


def buildGQLServer(data):
    project_name = data["projectName"]
    try:
        # 1. Start by copying the docker file and the id.json file required by solana to the newly created server
        shutil.copyfile('./src/template/deploy/Dockerfile',
                        './src/server/Dockerfile')
        shutil.copyfile('./src/template/deploy/id.json',
                        './src/server/id.json')

        # 2. Now edit the deploy script such that it uses the correct image and gcr container image
        svcName = project_name.replace("_", "")
        with open('./src/template/deploy/deploy.sh', 'r') as file:
            filedata = file.read()
        filedata = filedata \
            .replace('__CLOUDRUNSERVICENAME__', svcName+"gql") \
            .replace('__IMAGENAME__', ''.join((e for e in project_name if e.isalnum()))+"gql")
        with open('./src/server/deploy.sh', 'w') as file:
            file.write(filedata)

        # 3. Now submit a build for the image. This will build the docker image and push it to gcr.
        #    Also, deploy it on GCP Cloud Run and start the service.
        new_process = subprocess.run(
            "bash deploy.sh", stdout=subprocess.PIPE, cwd="./src/server", shell=True)
        if new_process.returncode != 0:
            print(
                f'{bcolors.FAIL}ERROR: An error occurred while running the deploy script for the newly generated project: {project_name}{bcolors.ENDC}')
            return None
        new_process = subprocess.run("gcloud run services describe " + svcName + "gql" +
                                     " --platform managed --region us-central1  --format 'value(status.url)'", stdout=subprocess.PIPE, shell=True)
        if new_process.returncode != 0:
            print(
                f'{bcolors.FAIL}ERROR: An error occurred when attempting to get the details on new deployment for project: {project_name}{bcolors.ENDC}')
            return None
        url = ((new_process.stdout).decode("utf-8").replace("\n", ""))
        subprocess.Popen(['rm', '-rf', './src/server'])
        print(f'{bcolors.OKGREEN}DONE: Project deploy successful for project: {project_name}{bcolors.ENDC}')
        return url
    except Exception as e:
        print(
            f'{bcolors.FAIL}ERROR: Something went wrong when attempting to deploy the project: {project_name}{bcolors.ENDC}')
        subprocess.Popen(['rm', '-rf', './src/server'])
        return None


def print_results(results):
    print()
    print("===================================================")
    print("===================================================")
    print("===================================================")
    print()
    print(f'{bcolors.OKBLUE}INFO: Test results:{bcolors.ENDC}')
    for result in results:
        if result['passed']:
            print(
                f'{bcolors.OKGREEN}{result["projectName"]}: Passed{bcolors.ENDC}')
        else:
            print(
                f'{bcolors.FAIL}{result["projectName"]}: Failed{bcolors.ENDC}')
    print()
    print("===================================================")
    print("=================== End of Run ====================")
    print("===================================================")


async def main():
    os.chdir('./anchorgql')
    config = json.load(open('channels.json'))
    channels_config = config['channels']
    results = []
    for channel in channels_config:
        project_name = channel['PROJECT_NAME']
        program_id = channel['PROGRAM_ID']
        # acquire new idl if program id is not null. Otherwise, simply copy the existing idl as idl.json
        if program_id is not None and program_id != "":
            acquire_idl_for_program(program_id, project_name)
        shutil.copyfile(
            f'./src/idls/{project_name.replace("_mainnet", "").replace("_devnet", "")}.json', './src/idls/idl.json')
        gqlData = {
            "projectName": project_name,
            "programID": program_id,
            "anchorProviderURL": channel['ANCHOR_PROVIDER_URL'],
            "idlPath": "./src/idls/idl.json",
            "anchorVersion": "0.14.0",
            "IDL": channel["IDL_PATH"],
            "port": 51305,
            "packageJsonTemplateFile": "./src/template/package-template.json",
            "indexTemplateFile": "./src/template/index-template.ts",
            "typeDefTemplateFile": "./src/template/typedef-template.ts",
            "configFile": "./src/config.ts",
            "testMode": True,
            "prdMode": True
        }
        create_project_config('./src/config.json', gqlData)
        result = build_and_start_server(project_name, config["prdMode"])
        if result:
            gqlURL = buildGQLServer(gqlData)
            if gqlURL is not None:
                result = addHasuraRemoteSchema(gqlURL, project_name)
                results.append({
                    "projectName": project_name,
                    "passed": result
                })
    print_results(results)


if __name__ == '__main__':
    asyncio.run(main())
