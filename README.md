# About

The project creates a GraphQL Apollo server from an IDL file.

## Prerequesites

- Node.js 16

- Python 3.10 or higher (for testing)

- VSCode is recommended but not required

## Setup Instructions

1. Clone the repo.
2. Change to the anchorgql directory by running `cd anchorgql`.
3. Configure the settings in the `config.json` file in the src directory.
4. Run `npm start`. This will generate the GraphQL project and start the GraphQL server for the IDL file.

## Testing

The project includes a Python script (runLocal.py) which tests the project by generating projects for all the configured channels and then attempting to start them. The script prints the results detailing the projects where these steps succeeded and where they failed.

### Notes on testing -

1. The test script will generate the config files for each channel when attempting to generate their projects. It pulls the config for various projects from the channels.json file. When running the test, it will attempt to download the IDL's from chain. Doing so requires a Solana identity setup on your testing machine. Running the script without the identity setup will run the tests without downloading the newest IDL's from chain.

2. The file has a config for testMode. In test mode, the server is stopped immediately after starting successfully. Set it to false if you want to keep the server running.