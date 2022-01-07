import { camelCase } from 'lodash';
import * as config from '../config.json';
import { Idl, IdlField, IdlType, IdlTypeDef, Operation } from '../types';
import {
    convertPascal,
    getFiltersForIDLType,
    getGqlTypeForIdlScalarType,
    getKeyForIdlObjectType,
    getKeyOrGQLTypeForIDLType,
} from '../utils';

export async function getAccountTypes(idlConfig: Idl): Promise<Operation[]> {
    const projectName = config.projectName;
    try {
        if ('accounts' in idlConfig) {
            let mapping: Operation[] = idlConfig.accounts.map((x: IdlTypeDef) => {
                let name = convertPascal(projectName) + '_' + x.name + 'Account';
                let fields = x.type.fields.map((y) => {
                    let key: string;
                    // if (typeof y.type === "string" || y.type instanceof String) {
                    //   key = "String";
                    // } else
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

export async function getStructTypes(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let typeArr: Operation[] = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        let idlStructTypes = idlTypes.filter((x) => x.type.kind === 'struct');
        for (let x of idlStructTypes) {
            let name: string = convertPascal(projectName) + '_' + x.name;
            let values = [];
            values = x.type.fields.map((y: IdlField) => {
                let key = getKeyOrGQLTypeForIDLType(y.type);
                return {
                    [y['name']]: key,
                };
            });
            let filters = getFiltersForIDLType(x.type);
            if (values.length > 0) {
                typeArr.push([name, Object.assign({}, ...values), Object.assign({}, ...filters)]);
            }
        }
    }
    return typeArr;
}

//#region Enums

export async function getEnumTypes(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let typeArr: Operation[] = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        let idlEnumTypes = idlTypes.filter((x) => x.type.kind === 'enum');
        for (let x of idlEnumTypes) {
            let enumVariants = x.type.variants;
            let variantsWithFields = [];
            // first generate types for all the variants with fields in them
            let enumVariantNames = [];
            enumVariants.map((e) => {
                enumVariantNames.push(e.name);
                if ('fields' in e) {
                    let name = e.name;
                    let values = e.fields.map((z: IdlField | IdlType) => {
                        if (z instanceof Object) {
                            const castedIdlField = z as IdlField;
                            return {
                                [camelCase(castedIdlField.name)]: getKeyOrGQLTypeForIDLType(castedIdlField.type),
                            };
                        } else {
                            return {
                                [camelCase(z)]: getKeyOrGQLTypeForIDLType(z),
                            };
                        }
                    });
                    const typeName = convertPascal(projectName) + '_' + name;
                    typeArr.push([typeName, Object.assign({}, ...values)]);
                    variantsWithFields.push(typeName);
                }
            });

            // The implementation of buildType for enums depends on this. Edit with Caution

            const typeNameForDataFieldInfoType = convertPascal(projectName) + '_' + 'Data_Fields_Info';

            typeArr.push([
                convertPascal(projectName) + '_' + x.name,
                {
                    name: enumVariantNames.map((n) => n.toLowerCase()).toString(),
                    data: `${
                        variantsWithFields.length > 0
                            ? variantsWithFields.concat([typeNameForDataFieldInfoType]).join(' | ')
                            : typeNameForDataFieldInfoType
                    }`,
                },
            ]);
        }
    }
    return typeArr;
}

//#endregion
