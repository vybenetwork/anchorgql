# About

The project creates a GraphQL Apollo server from an IDL file.

## Prerequesites

- Node.js 14 

- Solana installed with an identity setup (There must be an id.json file in your config for Solana. For details on this, refer to the docs on installing [Solana](https://docs.solana.com/cli/install-solana-cli-tools#:~:text=%20Windows%23%20%201%20Open%20a%20Command%20Prompt,Solana%20installer%20into%20a%20temporary%20directory%3A%20More%20) and [setting up identity](https://docs.solana.com/running-validator/validator-start#generate-identity).

- VSCode is recommended but not required

## Setup Instructions

1. Clone the repo.
2. Change to the anchorgql directory by running `cd anchorgql`.
3. Configure the settings in the `config.json` file in the src directory.
4. Run `npm start`. This will generate the GraphQL project.
5. Change directory to the newly generated project. Run `npm start`. This will install the dependencies for the project and start the server.