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
    OperationType,
    OperationName,
    OpertationReturnType,
} from './types';
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { camelCase } from 'lodash';

//** Edit this to change your server directory */
const subDir = config.prdMode ? './src/server' : './src/program_' + config.projectName;

function convertPascal(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function isSpecialEnum(
    operation: [type: OperationType, options: Record<OperationName, OpertationReturnType>],
): boolean {
    return (
        Object.keys(operation).length === 2 &&
        Object.keys(operation[1]).includes('name') &&
        Object.keys(operation[1]).includes('data')
    );
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
        return `[${getKeyOrGQLTypeForIDLType(castedVecType)}]`;
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
    const intTypes = ['u8', 'i8', 'u16', 'i16', 'i32'];
    const bigIntTypes = ['u32', 'u64', 'i64', 'u128', 'i128'];

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

async function getTypesForStructs(): Promise<Operations> {
    let projectName = config.projectName;
    let typeArr: Operations = [];
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
            if (values.length > 0) {
                typeArr.push([name, Object.assign({}, ...values)]);
            }
        }
    }
    return typeArr;
}

async function getTypesForEnums(): Promise<Operations> {
    let projectName = config.projectName;
    let typeArr: Operations = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        let idlEnumTypes = idlTypes.filter((x) => x.type.kind === 'enum');
        for (let x of idlEnumTypes) {
            let enumVariants = x.type.variants;
            let variantsWithFields = [];
            // first generate types for all the variants with fields in them
            enumVariants.map((e) => {
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
                    name: 'String',
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

async function buildType(
    mapping: Operations,
    options: { isQueryString?: boolean; isEnumString?: boolean } = { isQueryString: false, isEnumString: false },
): Promise<string> {
    if (mapping.length !== 0) {
        let stringType = mapping.map((x) => {
            let returnType = `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, '');
            if (options.isQueryString) {
                const tokenized = returnType.split('{');
                returnType =
                    tokenized[0] +
                    ' {' +
                    `\n\t"""\n\t{"programID": "${config.programID}", "protocol": "${config.protocol}", "projectName": "${config.projectName}", "network": "${config.network}"}\n\t"""` +
                    tokenized[1];
            }

            // generate the additional union type for special enum type
            if (options.isEnumString) {
                if (isSpecialEnum(x)) {
                    let unionType = x[1].data;
                    const unionTypeSplit = unionType.split('|');
                    if (unionTypeSplit.length > 1) {
                        const unionTypeString = `union ${x[0]}_Data = ${unionType} \n\n`;
                        let returnTypeSplit = returnType.split('data:');
                        returnType = unionTypeString + returnTypeSplit[0] + `data: ${x[0]}_Data \n}  \n`;
                    }
                }
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
    let structTypes = await getTypesForStructs();
    let enumTypes = await getTypesForEnums();

    let queryStr = await buildType(query, { isQueryString: true });
    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let structTypesStr = await buildType(structTypes);
    let enumTypesStr = await buildType(enumTypes, { isEnumString: true });
    let addionalDataInfoType = `\n\ntype ${
        convertPascal(config.projectName) + '_' + 'Data_Fields_Info'
    } {\n\tmessage: String\n},`;
    let typesStr = structTypesStr + enumTypesStr + addionalDataInfoType;

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

    await buildEnumFieldResolvers(indexOutputFile);
}

function generateFieldResolverForEnum(
    enumData: [type: OperationType, options: Record<OperationName, OpertationReturnType>],
    enumTypes: Operations,
): string {
    const projectName = convertPascal(config.projectName);
    const fieldResolver = `${enumData[0]}: {
        name: async(parent) => {
            return Object.keys(parent)[0]
        },
        data: async(parent) => {
            return Object.keys(parent[Object.keys(parent)[0]]).length > 0 ? parent[Object.keys(parent)[0]] : {message: 'No Fields exist for this variant'}
        }
    },
    `;

    let unionTypeResolver = '';
    let dataTypes = enumData[1]['data'].split('|');
    if (dataTypes.length > 1) {
        unionTypeResolver += `${enumData[0]}_Data: {\n\t\t__resolveType: (obj) => {`;
        dataTypes.forEach((dataTypeName) => {
            dataTypeName = dataTypeName.trim();
            if (dataTypeName !== projectName + '_' + 'Data_Fields_Info') {
                let additionalDataFieldTypes = Object.keys(enumTypes.filter((e) => e[0] === dataTypeName)[0][1]);
                let propertiesWithObj = additionalDataFieldTypes.map((a) => `obj.${a}`);
                unionTypeResolver += `\n\t\t\tif (${propertiesWithObj.join(
                    ' && ',
                )}) {\n\t\t\t\treturn "${dataTypeName}"\n\t\t\t}`;
            }
        });
        unionTypeResolver += `\n\t\treturn "${projectName}_Data_Fields_Info";\n\t}\n},\n`;
    }

    return fieldResolver + unionTypeResolver;
}

async function buildEnumFieldResolvers(indexOutputFile: string): Promise<void> {
    const enumFieldResolverString = '///----------ENUM_FIELD_RESOLVERS----------///';
    let allEnumTypes = await getTypesForEnums();
    // Filter to get only the main enum types and not the types for fields. Can cause a bug if a the type of
    // the field has data and name as keys and the type of data starts with Void. So far, in schema, we only
    // allow Void's here so this shouldn't happen but will have to be careful here
    const specialEnumTypes = allEnumTypes.filter((t) => isSpecialEnum(t));
    let data = await readFile(indexOutputFile, 'utf8');
    let split = data.split(enumFieldResolverString);
    let fieldResolverString = '';

    specialEnumTypes.map(async (x) => {
        fieldResolverString += generateFieldResolverForEnum(x, allEnumTypes);
    });
    const updatedResolverFileData =
        split[0] +
        enumFieldResolverString +
        '\n' +
        '\t' +
        fieldResolverString +
        enumFieldResolverString +
        split[1] +
        split[2];
    await writeFile(indexOutputFile, updatedResolverFileData);
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
