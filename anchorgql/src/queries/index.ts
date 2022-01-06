import * as config from '../config.json';
import { Idl, IdlTypeDef, Operation } from '../types';
import { convertPascal, getGqlTypeForIdlScalarType, getKeyForIdlObjectType } from '../utils';

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
                        //TODO: add checks for other types here
                        key = getGqlTypeForIdlScalarType(y.type);
                    }
                    return {
                        [y['name']]: key,
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

export async function getQueryType(): Promise<Operation[]> {
    const projectName = config.projectName;
    let subgraph = 'program_' + projectName;
    return [['Query', { [subgraph]: convertPascal(projectName) }]];
}

export async function getRootType(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let accountNames = [];

    if ('accounts' in idlConfig) {
        accountNames = idlConfig.accounts.map((x: IdlTypeDef) => {
            return {
                [projectName + '_' + x.name + ' (id: String)']: '[' + convertPascal(projectName) + '_' + x.name + ']',
            };
        });
        accountNames.push({ config: 'Config' });
        // 'events' in idlConfig ? accountNames.push({ events: 'JSON' }) : null;
        return [[projectName.charAt(0).toUpperCase() + projectName.slice(1), Object.assign({}, ...accountNames)]];
    } else {
        accountNames.push({ config: 'Config' });
        // 'events' in idlConfig ? accountNames.push({ events: 'JSON' }) : null;
        return [[projectName.charAt(0).toUpperCase() + projectName.slice(1), Object.assign({}, ...accountNames)]];
    }
}
