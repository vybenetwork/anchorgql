import * as config from './config.json';
import {
    IdlField,
    IdlType,
    IdlTypeDef,
    IdlTypeDefined,
    IdlTypeVec,
    Operations,
    IdlTypeOption,
    IdlTypeArray,
} from './types';
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { camelCase } from 'lodash';

//** Edit this to change your server directory */
const subDir = config.prdMode ? './src/server' : './src/program_' + config.projectName;

function convertPascal(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getKeyOrGQLTypeForIDLType(idlType: IdlType): string {
    if (idlType instanceof Object) {
        return getKeyForIdlObjectType(idlType);
    } else {
        return getGqlTypeForIdlScalarType(idlType);
    }
}

function getKeyForIdlObjectType(idlObjectType: IdlTypeVec | IdlTypeOption | IdlTypeDefined | IdlTypeArray): string {
    let projectName = config.projectName;
    let key: string;
    if ('vec' in idlObjectType) {
        let castedVecType = idlObjectType.vec;
        return getKeyOrGQLTypeForIDLType(castedVecType);
    } else if ('option' in idlObjectType) {
        let castedOptionType = idlObjectType.option;
        return getKeyOrGQLTypeForIDLType(castedOptionType);
    } else if ('array' in idlObjectType) {
        let castedArrayType = idlObjectType.array[0];
        return `[${getKeyOrGQLTypeForIDLType(castedArrayType)}]`;
    } else if ('defined' in idlObjectType) {
        key = convertPascal(projectName) + '_' + idlObjectType.defined;
    } else {
        throw 'An unsupported object type was encountered in the IDL by the indexer.';
    }
    return key;
}

function getGqlTypeForIdlScalarType(idlType: IdlType): string {
    const stringTypes = ['bytes', 'string', 'publicKey'];
    const intTypes = ['u8', 'i8', 'u16', 'i16', 'u32', 'i32'];
    const bigIntTypes = ['u64', 'i64', 'u128', 'i128'];

    const idlTypeStringified = idlType as string;

    if (stringTypes.includes(idlTypeStringified)) {
        return 'String';
    } else if (intTypes.includes(idlTypeStringified)) {
        return 'Int';
    } else if (bigIntTypes.includes(idlTypeStringified)) {
        return 'BigInt';
    } else if (idlTypeStringified === 'bool') {
        return 'Boolean';
    } else {
        throw 'An unsupported scalar type was encountered in the IDL by the indexer.';
    }
}

async function getAccountTypes(): Promise<Operations> {
    const projectName = config.projectName;
    try {
        if ('accounts' in idlConfig) {
            let mapping = idlConfig.accounts.map((x: IdlTypeDef) => {
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

async function getAccountRootTypes(): Promise<Operations> {
    let projectName = config.projectName;
    if ('accounts' in idlConfig) {
        let mapping = idlConfig.accounts.map((x: IdlTypeDef) => {
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

async function getQueryType(): Promise<Operations> {
    const projectName = config.projectName;
    let subgraph = 'program_' + projectName;
    return [['Query', { [subgraph]: convertPascal(projectName) }]];
}

async function getRootType(): Promise<Operations> {
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

async function getTypes(): Promise<Operations> {
    let projectName = config.projectName;
    let typeArr: Operations = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        for (let x of idlTypes) {
            let name: string = convertPascal(projectName) + '_' + x.name;
            let values = [];
            if (x.type.kind === 'struct') {
                values = x.type.fields.map((y: IdlField) => {
                    let key = getKeyOrGQLTypeForIDLType(y.type);
                    return {
                        [y['name']]: key,
                    };
                });
                if (values.length > 0) {
                    typeArr.push([name, Object.assign({}, ...values)]);
                }
            } else if (x.type.kind === 'enum') {
                let mainTypeFields = x.type.variants.map((x) => {
                    return {
                        [camelCase(x.name)]: convertPascal(projectName) + '_' + x.name,
                    };
                });
                typeArr.push([convertPascal(projectName) + '_' + x.name, Object.assign({}, ...mainTypeFields)]);
                for (let y of x.type.variants) {
                    if ('fields' in y) {
                        let name = y.name;
                        let values = y.fields.map((z: IdlField | IdlType) => {
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
                        values.push({ ts: 'String' });
                        typeArr.push([convertPascal(projectName) + '_' + name, Object.assign({}, ...values)]);
                    } else {
                        //TODO: apply a fix here
                        typeArr.push([convertPascal(projectName) + '_' + y['name'], { _: 'Boolean' }]);
                    }
                }
            }
        }
    }
    return typeArr;
}

async function buildType(mapping: Operations, isQueryString = false): Promise<string> {
    if (mapping.length !== 0) {
        let stringType = mapping.map((x) => {
            let returnType = `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, '');
            if (isQueryString) {
                const tokenized = returnType.split('{');
                returnType =
                    tokenized[0] +
                    ' {' +
                    `\n\t"""\n\t{"programID": "${config.programID}", "protocol": "${config.protocol}", "projectName": "${config.projectName}", "network": "${config.network}"}\n\t"""` +
                    tokenized[1];
            }
            return returnType;
        });

        return stringType.join('');
    } else {
        return '';
    }
}

async function buildTypeDef(typeDefTemplateFile: string, typeDefOutputFile: string): Promise<void> {
    let query = await getQueryType();
    let root = await getRootType();
    let accountRoot = await getAccountRootTypes();
    let account = await getAccountTypes();
    let types = await getTypes();

    let queryStr = await buildType(query, true);

    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let typesStr = await buildType(types);

    let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr;
    let data = await readFile(typeDefTemplateFile, 'utf8');
    const split = data.split('///--------------------///');
    let codeString = split[0];
    codeString = codeString.concat(typeDefs);
    codeString = codeString.concat(split[1]);
    await writeFile(typeDefOutputFile, codeString);
}

async function buildResolvers(indexTemplateFile: string, indexOutputFile: string): Promise<void> {
    let projectName = config.projectName;
    let url = config.anchorProviderURL;
    // ACCOUNT SETUP
    let data = await readFile(indexTemplateFile, 'utf8');
    var split = data.split('///----------ACCOUNT_RESOLVERS----------///');
    let codeString = split[0]
        .replace(/__URL__/g, url)
        .replace(/__PROJECTNAME__/g, 'program_' + projectName)
        .replace(/__ROOTNAME__/g, projectName.charAt(0).toUpperCase() + projectName.slice(1));
    if ('accounts' in idlConfig) {
        let accountNames = idlConfig['accounts'].map((x) => x['name']);
        for (let x of accountNames) {
            let acc = projectName + '_' + x;
            var result = split[1].replace(/__ANCHORACCOUNTNAME__/g, x.charAt(0).toLowerCase() + x.slice(1));
            var result = result.replace(/__ACCOUNTNAME__/g, acc);
            codeString = codeString.concat(result);
        }
        codeString = codeString.concat(split[2]);
    } else {
        codeString = codeString.concat(split[2]);
    }

    split = codeString.split('///----------EVENT_RESOLVER----------///');
    if ('events' in idlConfig) {
        codeString = split[0].concat(split[1]).concat(split[2]);
    } else {
        codeString = split[0].concat(split[2]);
        codeString = codeString.replace(/const eventParser = true/g, 'const eventParser = false');
    }
    await writeFile(indexOutputFile, codeString);
}

async function makeDirs() {
    await mkdir(subDir, { recursive: true });
    await mkdir(subDir + '/src/idls', { recursive: true });
}

async function copyFiles() {
    await copyFile('./src/template/package-template.json', subDir + '/package.json');
    let data = await readFile(subDir + `/package.json`, 'utf8');
    var result = data.replace(/__YOURANCHORPROVIDERURL__/g, config.anchorProviderURL);
    await writeFile(subDir + `/package.json`, result);
    await copyFile(config.idlPath, subDir + config.idlPath.substring(1));

    await copyFile('./src/template/tsconfig-template.json', subDir + '/tsconfig.json');
    await copyFile('./src/config.json', subDir + '/src/config.json');
}

async function main() {
    idlConfig = await import('../' + config.idlPath);
    const indexOutputFile = subDir + '/src/index.ts';
    const typeDefOutputFile = subDir + '/src/root.ts';
    await makeDirs();
    await copyFiles();
    await buildTypeDef(config.typeDefTemplateFile, typeDefOutputFile);
    await buildResolvers(config.indexTemplateFile, indexOutputFile);
    console.log('Successfully generated the new graphql project');
}

let idlConfig = null;
main();
