import json
import subprocess
import asyncio
from solana.rpc.async_api import AsyncClient
from solana.publickey import PublicKey
from anchorpy import Program, Provider, Wallet


class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def build_and_start_server(project_name, prd_mode):
    print(f'{bcolors.OKCYAN}INFO: Starting test for {project_name}')
    completed_process_result = subprocess.run(
        "npm run prod", shell=True)
    if completed_process_result.returncode != 0:
        print(
            f'{bcolors.FAIL}ERROR: Failed to generate Apollo GraphQL project for project: {project_name}{bcolors.ENDC}')
        return False
    print(f'{bcolors.OKGREEN}DONE: Project creation successful for project: {project_name}{bcolors.ENDC}')
    server_directory = "./src/server"
    new_process = subprocess.run(
        "npm start", cwd=server_directory, shell=True)
    if new_process.returncode != 0:
        print(
            f'{bcolors.FAIL}ERROR: Failed to start newly generated Apollo GraphQL server for project: {project_name}{bcolors.ENDC}')
        return False
    print(f'{bcolors.OKGREEN}DONE: Project startup successful for project: {project_name}{bcolors.ENDC}')
    return True


def create_project_config(path, content):
    with open(path, 'w') as f:
        f.write(json.dumps(content))
    return


async def check_and_replace_with_new_idl(program_id, idl_path, anchor_provider_url):
    client = AsyncClient(anchor_provider_url)
    provider = Provider(client, Wallet.local())
    program_id = PublicKey(program_id)
    try:
        idl = await Program.fetch_raw_idl(
            program_id, provider
        )
    except:
        await client.close()
        return
    if idl is not None:
        with open(idl_path, 'w') as file:
            json.dump(idl, file)
    await client.close()
    return


def main():
    # On Windows, if an error happens where the channels file isn't found, you probably opened the project
    # from the wrong directory. Either try reopening the project from the correct directory or play with the
    # line below.
    # os.chdir('./anchorgql')
    config = json.load(open('channels.json'))
    channels_config = config['channels']
    results = []
    for channel in channels_config:
        project_name = channel['PROJECT_NAME']
        program_id = channel['PROGRAM_ID']
        anchor_provider_url = channel['ANCHOR_PROVIDER_URL']
        idl_path = channel['IDL_PATH']
        asyncio.run(check_and_replace_with_new_idl(
            program_id, idl_path, anchor_provider_url))
        content = {
            "projectName": project_name,
            "protocol": channel["PROTOCOL"],
            "network": channel["NETWORK"],
            "programID": program_id,
            "anchorProviderURL": anchor_provider_url,
            "idlPath": idl_path,
            "anchorVersion": config['anchorVersion'],
            "idl": config['idl'],
            "port": config['port'],
            "packageJsonTemplateFile": config['packageJsonTemplateFile'],
            "indexTemplateFile": config['indexTemplateFile'],
            "typeDefTemplateFile": config['typeDefTemplateFile'],
            "configFile": config['configFile'],
            "testMode": config["testMode"],
            "prdMode": config["prdMode"]
        }
        create_project_config('./src/config.json', content)
        passed = build_and_start_server(project_name, config["prdMode"])
        results.append({
            "projectName": project_name,
            "passed": passed
        })

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


if __name__ == '__main__':
    main()
