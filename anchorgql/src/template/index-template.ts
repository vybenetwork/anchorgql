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

function applyFilterOnValue(value, filterValueToCompare, filter) {
    // not putting tripple eq and neq for BigInt and Int.
    if (filter === 'eq') {
        return value == filterValueToCompare;
    } else if (filter === 'neq') {
        return filterValueToCompare.reduce((prev, current) => prev && current != value, true);
    } else if (filter === 'gt') {
        return value > filterValueToCompare;
    } else if (filter === 'lt') {
        return value < filterValueToCompare;
    } else if (filter === 'contains') {
        return value.toString().includes(filterValueToCompare);
    } else if (filter === 'doesNotContain') {
        return !value.toString().includes(filterValueToCompare);
    } else if (filter === 'startsWith') {
        return value.toString().startsWith(filterValueToCompare);
    } else if (filter === 'endsWith') {
        return value.toString().endsWith(filterValueToCompare);
    }
}

function applyFilter(data, property, propertyFilters) {
    const filteredData = data.filter((d) => {
        let propValue = '';
        if (property === '') {
            propValue = d;
        } else {
            propValue = get(d, property);
        }
        const filtersForField = Object.keys(propertyFilters);
        return filtersForField.reduce(
            (prev, current) => prev && applyFilterOnValue(propValue, propertyFilters[current], current),
            true,
        );
    });
    return filteredData;
}

function applyOrderBy(data, property, propertyOrderBys) {
    const orderedData = data.sort((a, b) => {
        const propValue1 = get(a, property);
        const propValue2 = get(b, property);
        const orderBysForField = Object.keys(propertyOrderBys);

        return orderBysForField.reduce((prev, current) => {
            const orderByType = propertyOrderBys[current];
            if (orderByType === 'ASC') {
                return (propValue1 > propValue2 ? 1 : propValue2 > propValue1 ? -1 : 0) && prev;
            } else {
                return propValue1 > propValue2 ? -1 : propValue2 > propValue1 ? 1 : 0 && prev;
            }
        }, true);
    });
    return orderedData;
}

function isFilter(objectToCheck): boolean {
    return (
        typeof objectToCheck === 'object' &&
        Object.keys(objectToCheck)
            .filter((k) => k !== 'eq')
            .filter((k) => k !== 'neq')
            .filter((k) => k !== 'gt')
            .filter((k) => k !== 'lt')
            .filter((k) => k !== 'contains')
            .filter((k) => k !== 'doesNotContain')
            .filter((k) => k !== 'startsWith')
            .filter((k) => k !== 'endsWith')
            .filter((k) => k !== 'distinct').length === 0
    );
}

function isOrderBy(objectToCheck): boolean {
    return Object.keys(objectToCheck).filter((k) => k !== 'sortOrder').length === 0;
}

function getDistinctFilterPaths(whereFilter: any): string[] {
    let distinctFilters = [];
    let filters: any[] = [['ROOT', Object.entries(whereFilter)]];
    let filtersAtCurrentLevel = filters;
    while (filtersAtCurrentLevel.length > 0) {
        for (let fieldFilters of filtersAtCurrentLevel) {
            const pendingFilters = [];
            let propertyFilters = fieldFilters[1];
            for (let [property, propertyFilter] of propertyFilters) {
                if (isFilter(propertyFilter)) {
                    if ('distinct' in propertyFilter && propertyFilter['distinct'] === true) {
                        distinctFilters.push((fieldFilters[0] + '.' + property).replace('ROOT.', ''));
                    }
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
    return distinctFilters;
}

function applyAggregateFilters(data, allFilters) {
    let filters: any[] = [['ROOT', Object.entries(allFilters)]];
    let filtersAtCurrentLevel = filters;
    while (filtersAtCurrentLevel.length > 0) {
        for (let fieldFilters of filtersAtCurrentLevel) {
            const pendingFilters = [];
            let propertyFilters = fieldFilters[1];
            for (let [property, propertyFilter] of propertyFilters) {
                if (isFilter(propertyFilter)) {
                    const { distinct, ...nonDistinctFilters } = propertyFilter;
                    if (fieldFilters[0].split('.').length > 0 && fieldFilters[0].split('.')[1] === 'aggregate')
                        data = applyFilter(
                            [data],
                            (fieldFilters[0] + '.' + property).replace('ROOT.aggregate.', ''),
                            nonDistinctFilters,
                        );
                    if (data.length > 0) {
                        data = data[0];
                    } else {
                        return null;
                    }
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
    return data;
}

const resolvers = {
    BigInt: BigIntResolver,
    Byte: ByteResolver,
    Query: {
        __ACCOUNTS_ROOT_QUERY__: () => ({}),
        __ACCOUNT_AGGREGATES_ROOT_QUERY__: () => ({}),
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

                const distinctFilterPaths = getDistinctFilterPaths(args.where);
                for (let dFilterPath of distinctFilterPaths) {
                    data = [...new Map(data.map((item) => [get(item, dFilterPath), item])).values()];
                }

                let filters: any[] = [['ROOT', Object.entries(args.where)]];
                let filtersAtCurrentLevel = filters;
                while (filtersAtCurrentLevel.length > 0) {
                    for (let fieldFilters of filtersAtCurrentLevel) {
                        const pendingFilters = [];
                        let propertyFilters = fieldFilters[1];
                        for (let [property, propertyFilter] of propertyFilters) {
                            if (isFilter(propertyFilter)) {
                                const { distinct, ...nonDistinctFilters } = propertyFilter;
                                data = applyFilter(
                                    data,
                                    (fieldFilters[0] + '.' + property).replace('ROOT.', ''),
                                    nonDistinctFilters,
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

        config: async () => {
            return {
                provider: configVars.anchorProviderURL,
                programId: configVars.programID,
            };
        },
    },

    __ACCOUNT_AGGREGATE_ROOT_NAME__: {
        ///----------ACCOUNT_AGGREGATE_RESOLVERS----------///
        __ACCOUNTNAME__: async (parent, args) => {
            let data = await getAccountData('__ANCHORACCOUNTNAME__', args?.where?.publicKey?.eq ?? null);

            if (args?.where) {
                const distinctFilterPaths = getDistinctFilterPaths(args.where);
                for (let dFilterPath of distinctFilterPaths) {
                    data = [...new Map(data.map((item) => [get(item, 'account.' + dFilterPath), item])).values()];
                }

                let filters: any[] = [['ROOT', Object.entries(args.where)]];
                let filtersAtCurrentLevel = filters;
                while (filtersAtCurrentLevel.length > 0) {
                    for (let fieldFilters of filtersAtCurrentLevel) {
                        const pendingFilters = [];
                        let propertyFilters = fieldFilters[1];
                        for (let [property, propertyFilter] of propertyFilters) {
                            if (isFilter(propertyFilter)) {
                                const { distinct, ...nonDistinctFilters } = propertyFilter;
                                // only apply non aggregation filters here
                                if (
                                    fieldFilters[0].split('.').length > 0 &&
                                    fieldFilters[0].split('.')[1] !== 'aggregate'
                                ) {
                                    data = applyFilter(
                                        data,
                                        'account.' + (fieldFilters[0] + '.' + property).replace('ROOT.', ''),
                                        nonDistinctFilters,
                                    );
                                }
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

            if (data.length > 0) {
                let aggregateData = {};
                Object.entries(data[0].account).map(([k, v]) => {
                    if (typeof v === 'number' || typeof v === 'bigint') {
                        aggregateData[k] = {
                            count: data.length,
                            min: data.reduce(
                                (previous, current) => (current.account[k] < previous ? current.account[k] : previous),
                                0,
                            ),
                            max: data.reduce(
                                (previous, current) => (current.account[k] > previous ? current.account[k] : previous),
                                0,
                            ),
                            average:
                                data.reduce(
                                    (previousValue, currentValue) => previousValue + currentValue.account[k],
                                    0,
                                ) / data.length,
                            sum: data.reduce(
                                (previousValue, currentValue) => previousValue + currentValue.account[k],
                                0,
                            ),
                        };
                    } else if (typeof v === 'string') {
                        aggregateData[k] = {
                            count: data.length,
                        };
                    } else if (typeof v === 'boolean') {
                        aggregateData[k] = {
                            count: data.length,
                        };
                    }
                });
                if (args.where) {
                    aggregateData = applyAggregateFilters(aggregateData, args.where);
                }
                return aggregateData;
            }
            return {};
        },
        ///----------ACCOUNT_AGGREGATE_RESOLVERS----------///
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
