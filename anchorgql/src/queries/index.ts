import * as config from '../config.json';
import { Idl, IdlTypeDef, Operation } from '../types';
import {
    convertPascal,
    getFilterTypeForField,
    getGqlTypeForIdlScalarType,
    getKeyForIdlObjectType,
    shouldGenerateFilterForAnAccount,
} from '../utils';

/**
 * Get the types for each of the accounts associated with the program
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The fields for each of the accounts of the program in the {@link Operation} type
 */
export async function getAccountTypes(idlConfig: Idl): Promise<Operation[]> {
    const projectName = config.projectName;
    try {
        if ('accounts' in idlConfig) {
            let mapping: Operation[] = idlConfig.accounts.map((x: IdlTypeDef) => {
                let name = convertPascal(projectName) + '_' + x.name + 'Account';
                let fields = x.type.fields.map((y) => {
                    let key: string;
                    if (y.type instanceof Object) {
                        key = getKeyForIdlObjectType(y.type);
                    } else {
                        key = getGqlTypeForIdlScalarType(y.type);
                    }

                    // ARRAY LIMITS
                    if (key.startsWith('[') && key.endsWith(']')) {
                        const filterTypeForField = getFilterTypeForField(key, x.name, y.name);
                        return {
                            [y['name'] + `(limit: Int where: ${filterTypeForField})`]: key,
                        };
                    } else {
                        return {
                            [y['name']]: key,
                        };
                    }
                });

                return [name, Object.assign({}, ...fields)];
            });
            return mapping;
        } else {
            return [];
        }
    } catch (error) {
        console.log(error);
    }
}

/**
 * Get the object containing the public key and account info for each of the accounts associated with the program
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The fields for each of the accounts of the program in the {@link Operation} type
 */
export async function getAccountRootTypes(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    if ('accounts' in idlConfig) {
        let mapping: Operation[] = idlConfig.accounts.map((x: IdlTypeDef) => {
            let name = convertPascal(projectName) + '_' + x.name;
            let fields = {
                publicKey: 'String',
                account: convertPascal(projectName) + '_' + x.name + 'Account',
            };
            return [name, fields];
        });
        return mapping;
    } else {
        return [];
    }
}

/**
 * Get the root query type
 * @returns The root query type in {@link Operation} type
 */
export async function getQueryType(): Promise<Operation[]> {
    const projectName = config.projectName;
    let accountsSubGraph = 'program_' + projectName;
    let accountAggregatesSubGraph = 'program_' + projectName + '_aggregate';
    return [
        [
            'Query',
            {
                [accountsSubGraph]: convertPascal(projectName) + '_Accounts',
                [accountAggregatesSubGraph]: convertPascal(projectName) + '_Account_Aggregates',
            },
        ],
    ];
}

/**
 * Get the top level queries for the program
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The top level queries for the program in the {@link Operation} type
 */
export async function getRootType(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let accountNames = [];
    let aggregateNames = [];

    if ('accounts' in idlConfig) {
        idlConfig.accounts.map((x: IdlTypeDef) => {
            let accountName = {
                [projectName +
                '_' +
                x.name +
                `(where: ${convertPascal(projectName) + '_' + x.name}_Filters order_by: ${
                    convertPascal(projectName) + '_' + x.name
                }_OrderBy limit: Int = 10)`]: '[' + convertPascal(projectName) + '_' + x.name + ']',
            };
            accountNames.push(accountName);
            if (shouldGenerateFilterForAnAccount(x, idlConfig)) {
                aggregateNames.push({
                    [projectName +
                    '_' +
                    x.name +
                    `(where: ${convertPascal(projectName) + '_' + x.name}_Account_Filters)`]:
                        convertPascal(projectName) + '_' + x.name + '_Account_Aggregates',
                });
            }
        });

        accountNames.push({ config: 'Config' });
        accountNames.push({
            utils: convertPascal(projectName) + '_Utils',
        });

        return [
            [convertPascal(projectName) + '_Accounts', Object.assign({}, ...accountNames)],
            [convertPascal(projectName) + '_Account_Aggregates', Object.assign({}, ...aggregateNames)],
        ];
    } else {
        accountNames.push({ config: 'Config' });
        return [[projectName.charAt(0).toUpperCase() + projectName.slice(1), Object.assign({}, ...accountNames)]];
    }
}
