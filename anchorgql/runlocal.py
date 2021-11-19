import json
import subprocess
import os


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


def build_and_start_server(project_name):
    print(f'{bcolors.OKCYAN}INFO: Starting test for {project_name}')
    completed_process_result = subprocess.run(
        "npm install && npm start", shell=True)
    if completed_process_result.returncode != 0:
        print(
            f'{bcolors.FAIL}ERROR: Failed to generate Apollo GraphQL project for project: {project_name}{bcolors.ENDC}')
        print(f'{bcolors.FAIL}Exiting...{bcolors.ENDC}')
        exit(1)
    # new_process = subprocess.Popen(
    #     "npm install && npm start", cwd="./src/channel_" + project_name, shell=True)
    # return new_process


def create_project_config(path, content):
    with open(path, 'w') as f:
        f.write(json.dumps(content))
    return


def main():
    # print current working directory
    # os.chdir('./anchorgql')
    config = json.load(open('channels.json'))
    channels_config = config['channels']
    processes = []
    for channel in channels_config:
        project_name = channel['PROJECT_NAME']
        program_id = channel['PROGRAM_ID']
        anchor_provider_url = channel['ANCHOR_PROVIDER_URL']
        idl_path = channel['IDL_PATH']
        content = {
            "projectName": project_name,
            "programId": program_id,
            "anchorProviderURL": anchor_provider_url,
            "idlPath": idl_path,
            "anchorVersion": config['anchorVersion'],
            "idl": config['idl'],
            "port": config['port'],
            "packageJsonTemplateFile": config['packageJsonTemplateFile'],
            "indexTemplateFile": config['indexTemplateFile'],
            "typeDefTemplateFile": config['typeDefTemplateFile'],
            "configFile": config['configFile'],
        }
        create_project_config('./src/config.json', content)
        build_and_start_server(project_name)
        print(
            f'{bcolors.OKGREEN}DONE: Project creation successful for project: {project_name}{bcolors.ENDC}')
        # processes.append(build_and_start_server(project_name))


if __name__ == '__main__':
    main()
