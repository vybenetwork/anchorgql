import * as config from '../config.json';
import { Idl, IdlTypeDef, Operation } from '../types';
import { convertPascal, getFiltersForIDLType, getGqlTypeForIdlScalarType, getKeyForIdlObjectType } from '../utils';

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
                const filters = getFiltersForIDLType(x.type);
                let fields = x.type.fields.map((y) => {
                    let key: string;
                    if (y.type instanceof Object) {
                        key = getKeyForIdlObjectType(y.type);
                    } else {
                        //TODO: add checks for other types here
                        key = getGqlTypeForIdlScalarType(y.type);
                    }
                    // let argString = '';
                    // if (filters.length > 0) {
                    //     argString = `(where: ${name + '_Filters'})`;
                    // }

                    return {
                        [y['name'] /*+ argString*/]: key,
                    };
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
            const filters = getFiltersForIDLType(x.type);
            let argString = '';
            if (filters.length > 0) {
                argString = `(where: ${name + '_Account_Filters'})`;
            }
            let fields = {
                publicKey: 'String',
                ['account' + argString]: convertPascal(projectName) + '_' + x.name + 'Account',
            };
            return [name, fields, { [name + '_Account_Filters']: Object.assign({}, ...filters) }];
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
    let subgraph = 'program_' + projectName;
    return [['Query', { [subgraph]: convertPascal(projectName) }]];
}

/**
 * Get the top level queries for the program
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The top level queries for the program in the {@link Operation} type
 */
export async function getRootType(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let accountNames = [];
    let accountArgs = [];

    if ('accounts' in idlConfig) {
        idlConfig.accounts.map((x: IdlTypeDef) => {
            let accountName = {
                [projectName + '_' + x.name + `(where: ${convertPascal(projectName) + '_' + x.name}_Filters)`]:
                    '[' + convertPascal(projectName) + '_' + x.name + ']',
            };
            accountNames.push(accountName);
            const filterName = `${convertPascal(projectName) + '_' + x.name}_Filters`;
            accountArgs.push({ [filterName]: { publicKey: 'String' } });
        });

        accountNames.push({ config: 'Config' });
        const transactionsFilterName = projectName + '_Transactions(limit: Int)';
        accountNames.push({
            [transactionsFilterName]: '[JSON]',
        });
        return [
            [
                projectName.charAt(0).toUpperCase() + projectName.slice(1),
                Object.assign({}, ...accountNames),
                Object.assign({}, ...accountArgs),
            ],
        ];
    } else {
        accountNames.push({ config: 'Config' });
        return [[projectName.charAt(0).toUpperCase() + projectName.slice(1), Object.assign({}, ...accountNames)]];
    }
}

/**
 * Get the inputs for filters for different types
 * @returns Inputs for Filters in {@link Operation} format
 */
export function getFilterInputs(): Operation[] {
    let projectName = config.projectName;
    const stringFilter: Operation = [
        convertPascal(projectName) + '_' + 'String_Filters',
        {
            eq: 'String',
            neq: 'String',
        },
    ];

    const intFilter: Operation = [
        convertPascal(projectName) + '_' + 'Int_Filters',
        {
            eq: 'Int',
            neq: 'Int',
            gt: 'Int',
            lt: 'Int',
        },
    ];

    const bigIntFilter: Operation = [
        convertPascal(projectName) + '_' + 'BigInt_Filters',
        {
            eq: 'BigInt',
            neq: 'BigInt',
            gt: 'BigInt',
            lt: 'BigInt',
        },
    ];

    const booleanFilter: Operation = [
        convertPascal(projectName) + '_' + 'Boolean_Filters',
        {
            eq: 'Boolean',
        },
    ];
    return [stringFilter, intFilter, bigIntFilter, booleanFilter];
}
