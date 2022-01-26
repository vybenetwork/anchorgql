import { ApolloServer } from 'apollo-server-express';
import { BigIntResolver, ByteResolver } from 'graphql-scalars';
import express from 'express';
import { AddressInfo } from 'net';
import { Provider, setProvider, web3, Program } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { readFileSync } from 'fs';
import { get } from 'lodash';
import bs58 from 'bs58';
import configVars from './config.json';

const provider = Provider.env();
setProvider(provider);

const idl = JSON.parse(readFileSync(configVars.idlPath, 'utf8'));
const programId = new web3.PublicKey(configVars.programID);
const client = new Program(idl, programId);

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

/*
  Don't Move around this code. The code to create resolvers makes assumptions on this code 
  located here
 */
import { typeDefs } from './root';

function applyFilter(data, property, propertyFilters) {
    const filteredData = data.filter((d) => {
        let propValue = '';
        if (property === '') {
            propValue = d;
        } else {
            propValue = get(d, property);
        }
        const filtersForField = Object.keys(propertyFilters);
        for (let filter of filtersForField) {
            const filterValueToCompare = propertyFilters[filter];
            // not putting tripple eq and neq for BigInt and Int.
            if (filter === 'eq') {
                return propValue == filterValueToCompare;
            } else if (filter === 'neq') {
                return propValue != filterValueToCompare;
            } else if (filter === 'gt') {
                return propValue > filterValueToCompare;
            } else if (filter === 'lt') {
                return propValue < filterValueToCompare;
            } else if (filter === 'contains') {
                return propValue.toString().includes(filterValueToCompare);
            } else if (filter === 'doesNotContain') {
                return !propValue.toString().includes(filterValueToCompare);
            } else if (filter === 'startsWith') {
                return propValue.toString().startsWith(filterValueToCompare);
            } else if (filter === 'endsWith') {
                return propValue.toString().endsWith(filterValueToCompare);
            }
        }
    });
    return filteredData;
}

function applyOrderBy(data, property, propertyOrderBys) {
    const orderedData = data.sort((a, b) => {
        const propValue1 = get(a, property);
        const propValue2 = get(b, property);
        const orderBysForField = Object.keys(propertyOrderBys);
        for (let orderBy of orderBysForField) {
            const filterValueToCompare = propertyOrderBys[orderBy];
            if (filterValueToCompare === 'ASC') {
                return propValue1 > propValue2 ? 1 : propValue2 > propValue1 ? -1 : 0;
            } else {
                return propValue1 > propValue2 ? -1 : propValue2 > propValue1 ? 1 : 0;
            }
        }
    });
    return orderedData;
}

function isFilter(objectToCheck): boolean {
    return (
        Object.keys(objectToCheck)
            .filter((k) => k !== 'eq')
            .filter((k) => k !== 'neq')
            .filter((k) => k !== 'gt')
            .filter((k) => k !== 'lt')
            .filter((k) => k !== 'contains')
            .filter((k) => k !== 'doesNotContain')
            .filter((k) => k !== 'startsWith')
            .filter((k) => k !== 'endsWith').length === 0
    );
}

function isOrderBy(objectToCheck): boolean {
    return Object.keys(objectToCheck).filter((k) => k !== 'sortOrder').length === 0;
}

const resolvers = {
    BigInt: BigIntResolver,
    Byte: ByteResolver,
    Query: {
        __PROJECTNAME__: () => ({}),
    },

    __UTILITIES_TYPE_NAME__: {
        decodeAccountData: async (parent, args) => {
            const baseHexBuffer = Buffer.from(args.data, 'hex');
            const base58String = bs58.encode(baseHexBuffer);
            const base58Buffer = bs58.decode(base58String);
            try {
                const data = client.coder.accounts.decode(args.account, base58Buffer);
                return data;
            } catch {
                return {
                    error: 'Failed to parse passed data for the selected account. Please ensure the correct account is selected and that data is a valid hex encoded string.',
                };
            }
        },
    },

    __ROOTNAME__: {
        utils: async (parent, args) => {
            return {};
        },
        ///----------ACCOUNT_RESOLVERS----------///
        __ACCOUNTNAME__: async (parent, args) => {
            let data = await getAccountData('__ANCHORACCOUNTNAME__', args?.where?.publicKey?.eq ?? null);
            if (args?.where) {
                if (args.where.publicKey?.eq !== undefined) {
                    data = data.filter((d) => args.where.publicKey.eq === d.publicKey);
                }

                if (args.where.publicKey?.neq !== undefined) {
                    data = data.filter((d) => args.where.publicKey.neq !== d.publicKey);
                }

                let filters: any[] = [['ROOT', Object.entries(args.where)]];
                let filtersAtCurrentLevel = filters;
                while (filtersAtCurrentLevel.length > 0) {
                    for (let fieldFilters of filtersAtCurrentLevel) {
                        const pendingFilters = [];
                        let propertyFilters = fieldFilters[1];
                        for (let [property, propertyFilter] of propertyFilters) {
                            if (isFilter(propertyFilter)) {
                                data = applyFilter(
                                    data,
                                    (fieldFilters[0] + '.' + property).replace('ROOT.', ''),
                                    propertyFilter,
                                );
                            } else {
                                pendingFilters.push([fieldFilters[0] + '.' + property, Object.entries(propertyFilter)]);
                            }
                        }
                        filtersAtCurrentLevel = pendingFilters;
                        if (filtersAtCurrentLevel.length === 0) {
                            break;
                        }
                    }
                }
            }

            if (args?.order_by) {
                let orderBys: any[] = [['ROOT', Object.entries(args.order_by)]];
                let orderBysAtCurrentLevel = orderBys;
                while (orderBysAtCurrentLevel.length > 0) {
                    for (let fieldOrderBys of orderBysAtCurrentLevel) {
                        const pendingOrderBys = [];
                        let propertyOrderBys = fieldOrderBys[1];
                        for (let [property, propertyOrderBy] of propertyOrderBys) {
                            if (isOrderBy(propertyOrderBy)) {
                                data = applyOrderBy(
                                    data,
                                    (fieldOrderBys[0] + '.' + property).replace('ROOT.', ''),
                                    propertyOrderBy,
                                );
                            } else {
                                pendingOrderBys.push([
                                    fieldOrderBys[0] + '.' + property,
                                    Object.entries(propertyOrderBy),
                                ]);
                            }
                        }
                        orderBysAtCurrentLevel = pendingOrderBys;
                        if (orderBysAtCurrentLevel.length === 0) {
                            break;
                        }
                    }
                }
            }

            if (args?.limit) {
                data = data.slice(0, args.limit);
            }

            return data;
        },
        ///----------ACCOUNT_RESOLVERS----------///

        // __TRANSACTION_NAME__: async (parent, args) => {
        //     let sigatures = await provider.connection.getSignaturesForAddress(
        //         programId,
        //         {
        //             limit: args?.limit ? Math.min(args.limit, 25) : 10,
        //         },
        //         'finalized',
        //     );

        //     if (args?.limit) {
        //         sigatures = sigatures.slice(0, Math.min(args.limit, 25));
        //     }
        //     const transactions = await Promise.all(
        //         sigatures.map((s) => {
        //             return provider.connection.getTransaction(s.signature, {
        //                 commitment: 'finalized',
        //             });
        //         }),
        //     );
        //     return transactions;
        // },

        config: async () => {
            return {
                provider: configVars.anchorProviderURL,
                programId: configVars.programID,
            };
        },
    },

    ///----------ARRAY_FIELD_RESOLVERS----------///

    ///----------ARRAY_FIELD_RESOLVERS----------///

    ///----------ENUM_FIELD_RESOLVERS----------///

    ///----------ENUM_FIELD_RESOLVERS----------///
};

async function startApolloServer() {
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
