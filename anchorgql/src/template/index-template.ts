import { ApolloServer } from 'apollo-server-express';
import { BigIntResolver } from 'graphql-scalars';
import express from 'express';
import { AddressInfo } from 'net';
import { Provider, setProvider, web3, Program } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { readFileSync } from 'fs';
import configVars from './config.json';

const provider = Provider.env();
setProvider(provider);

const idl = JSON.parse(readFileSync(configVars.idlPath, 'utf8'));
const programId = new web3.PublicKey(configVars.programID);
const client = new Program(idl, programId);
const LOG_START_INDEX = 'Program log: '.length;
const eventParser = true;
let globalEvents = [];

function pubKeyBigNumTransform(o) {
    Object.keys(o).forEach(function (k) {
        if (o[k] instanceof PublicKey) {
            o[k] = o[k].toBase58();
        }
        if (o[k] instanceof BN) {
            o[k] = parseInt(o[k]);
        }
        if (o[k] !== null && typeof o[k] === 'object') {
            pubKeyBigNumTransform(o[k]);
        }
    });
    return o;
}

async function getAccountData(account: string, id = null) {
    if (id !== null) {
        let value = await client.account[account].fetch(id);
        let transformed = pubKeyBigNumTransform(value);
        return [
            {
                publicKey: id,
                account: transformed,
            },
        ];
    } else {
        let value = await client.account[account].all();
        let transformed = pubKeyBigNumTransform(value);
        return transformed;
    }
}

// async function parseEvents() {
//     console.log('Parsing events');
//     provider.connection.onLogs(programId, (x) => {
//         let allLogs = x.logs;
//         allLogs.forEach((l) => {
//             if (l.startsWith('Program log:')) {
//                 const logStr = l.slice(LOG_START_INDEX);
//                 try {
//                     const event = client.coder.events.decode(logStr);
//                     if (event !== null) {
//                         let eventValues = pubKeyBigNumTransform(event);
//                         eventValues['ts'] = Date.now();
//                         globalEvents.push = function (elem) {
//                             if (this.length == 1000) {
//                                 this.pop();
//                             }
//                             return [].unshift.call(this, elem);
//                         };
//                         globalEvents.push(eventValues);
//                         // console.log("Event Count: "+globalEvents.length)
//                     }
//                 } catch (error) {
//                     console.log(error);
//                 }
//             }
//         });
//     });
// }

/*
  Don't Move around this code. The code to create resolvers makes assumptions on this code 
  located here
 */
import { typeDefs } from './root';

const resolvers = {
    BigInt: BigIntResolver,
    Query: {
        __PROJECTNAME__: () => ({}),
    },
    __ROOTNAME__: {
        ///----------ACCOUNT_RESOLVERS----------///
        __ACCOUNTNAME__: async (parent, args) => {
            let data = await getAccountData('__ANCHORACCOUNTNAME__', args['publicKey']);
            if (args?.where?.publicKey?.eq === undefined && args?.where?.publicKey?.neq === undefined) {
                return data;
            }
            if (args?.where?.publicKey?.eq !== undefined) {
                data = data.filter((d) => args.where.publicKey.eq === d.publicKey);
            }

            if (args?.where?.publicKey?.neq !== undefined) {
                data = data.filter((d) => args.where.publicKey.neq !== d.publicKey);
            }
            return data;
        },
        ///----------ACCOUNT_RESOLVERS----------///

        ///----------EVENT_RESOLVER----------///
        // events: async (_) => {
        //     return globalEvents.sort((a, b) => b.ts - a.ts);
        // },
        ///----------EVENT_RESOLVER----------///

        config: async () => {
            return {
                provider: configVars.anchorProviderURL,
                programId: configVars.programID,
            };
        },
    },
    ///----------FIELD_RESOLVERS-FOR-FILTERS----------///

    __PROPERTY_NAME__: {
        __FIELD_NAME__: async (parent, args, context, info) => {
            if (args.where) {
                let returnData = parent;
                const filters = args.where;
                for (let field of Object.keys(filters)) {
                    const filtersForField = Object.keys(filters[field]);
                    for (let filter of filtersForField) {
                        const filterValueToCompare = filters[field][filter];
                        if (returnData.account && field in returnData.account) {
                            // not putting tripple eq and neq for BigInt and Int.
                            if (filter === 'eq') {
                                returnData = returnData.account[field] == filterValueToCompare ? parent : {};
                            } else if (filter === 'neq') {
                                returnData = returnData.account[field] != filterValueToCompare ? parent : {};
                            } else if (filter === 'gt') {
                                returnData = returnData.account[field] > filterValueToCompare ? parent : {};
                            } else if (filter === 'lt') {
                                returnData = returnData.account[field] < filterValueToCompare ? parent : {};
                            }
                        }
                    }
                }
                return returnData.account;
            }
            return parent.account;
        },
    },

    ///----------FIELD_RESOLVERS-FOR-FILTERS----------///

    ///----------ENUM_FIELD_RESOLVERS----------///

    ///----------ENUM_FIELD_RESOLVERS----------///
};

async function startApolloServer() {
    // eventParser ? parseEvents() : null;
    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();

    const app = express();
    server.applyMiddleware({ app });

    let startedApp = app.listen(8080, () => {
        const castedApp = startedApp.address() as AddressInfo;
        console.log(`🚀 Server ready at port ${castedApp?.port}`);

        if (configVars.testMode) {
            startedApp.close((err) => {
                console.log('Test Mode is enabled so closing server');
                process.exit(0);
            });
        }
    });
    return { server, app };
}

startApolloServer();
