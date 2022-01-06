import { Idl, OperationName, Operation, OperationType, OpertationReturnType } from '../types';
import { convertPascal, isSpecialEnum } from '../utils';
import * as config from '../config.json';
import { getEnumTypes } from '../types/index';
import { readFile, writeFile } from 'fs/promises';

export function generateFieldResolverForEnum(enumData: Operation, enumTypes: Operation[]): string {
    const projectName = convertPascal(config.projectName);
    const fieldResolver = `${enumData[0]}: {
        name: async(parent) => {
            return Object.keys(parent)[0].toLowerCase()
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

export async function buildResolvers(
    idlConfig: Idl,
    indexTemplateFile: string,
    indexOutputFile: string,
): Promise<void> {
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

    await buildEnumFieldResolvers(indexOutputFile, idlConfig);
}

export async function buildEnumFieldResolvers(indexOutputFile: string, idlConfig: Idl): Promise<void> {
    const enumFieldResolverString = '///----------ENUM_FIELD_RESOLVERS----------///';
    let allEnumTypes = await getEnumTypes(idlConfig);
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
