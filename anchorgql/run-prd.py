import json
import subprocess


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
    print(f'{bcolors.OKCYAN}INFO: Starting project {project_name}')
    completed_process_result = subprocess.run(
        "npm install && npm start", shell=True)
    if completed_process_result.returncode != 0:
        print(
            f'{bcolors.FAIL}ERROR: Failed to generate Apollo GraphQL project for project: {project_name}{bcolors.ENDC}')
    print(f'{bcolors.OKGREEN}DONE: Project creation successful for project: {project_name}{bcolors.ENDC}')
    new_process = subprocess.run(
        "npm install && npm start", cwd="./src/channel_" + project_name, shell=True)
    if new_process.returncode != 0:
        print(
            f'{bcolors.FAIL}ERROR: Failed to start newly generated Apollo GraphQL server for project: {project_name}{bcolors.ENDC}')


def create_project_config(path, content):
    with open(path, 'w') as f:
        f.write(json.dumps(content))
    return


def main():
    # On Windows, if an error happens where the channels file isn't found, you probably opened the project
    # from the wrong directory. Either try reopening the project from the correct directory or play with the
    # line below.
    # os.chdir('./anchorgql')
    config = json.load(open('config-prd.json'))
    project_name = config['projectName']
    content = {
        "projectName": project_name,
        "programID": config['programID'],
        "anchorProviderURL": config['anchorProviderURL'],
        "idlPath": config['idlPath'],
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
    build_and_start_server(project_name)


if __name__ == '__main__':
    main()
