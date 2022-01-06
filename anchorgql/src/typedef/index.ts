import { Idl, Operation } from '../types';
import { getAccountRootTypes, getAccountTypes, getQueryType, getRootType } from '../queries';
import { getEnumTypes, getStructTypes } from '../types/index';
import * as config from '../config.json';
import { convertPascal, isSpecialEnum } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import { buildEnumFieldResolvers } from '../resolvers';

async function buildType(
    mapping: Operation[],
    options: { isQueryString?: boolean; isEnumString?: boolean; isInstructionString?: boolean } = {
        isQueryString: false,
        isEnumString: false,
        isInstructionString: false,
    },
): Promise<string> {
    if (mapping.length !== 0) {
        let stringType = mapping
            .filter((x) => Object.keys(x[1]).length > 0)
            .map((x) => {
                let returnType = `\n${options.isInstructionString ? 'input' : 'type'} ${x[0]} ${JSON.stringify(
                    x[1],
                    null,
                    4,
                )} \n`.replace(/['",]+/g, '');
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
                            const unionTypeString = `\nunion ${x[0]}_Data = ${unionType} \n\n`;
                            let returnTypeSplit = returnType.split('data:');
                            returnType = unionTypeString + returnTypeSplit[0] + `data: ${x[0]}_Data \n}  \n`;
                        }

                        const enumTypes = x[1].name.split(',');
                        const joinedEnumTypes = enumTypes.join('');
                        let nameForEnumVariantNames = `${x[0]}_Names`;
                        returnType = returnType.replace(joinedEnumTypes, nameForEnumVariantNames);

                        let enumString = `\nenum ${nameForEnumVariantNames} {\n\t ${enumTypes.join('\n\t')} \n} \n`;
                        returnType += enumString;
                    }
                }

                return returnType;
            });

        return stringType.join('');
    } else {
        return '';
    }
}

export async function buildTypeDef(
    idlConfig: Idl,
    typeDefTemplateFile: string,
    typeDefOutputFile: string,
): Promise<void> {
    // First get all the types
    let query = await getQueryType();
    let root = await getRootType(idlConfig);
    let accountRoot = await getAccountRootTypes(idlConfig);
    let account = await getAccountTypes(idlConfig);
    let structTypes = await getStructTypes(idlConfig);
    let enumTypes = await getEnumTypes(idlConfig);

    // Process the types to create valid gql strings
    let queryStr = await buildType(query, { isQueryString: true });
    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let structTypesStr = await buildType(structTypes);
    let enumTypesStr = await buildType(enumTypes, { isEnumString: true });
    //let instructionInputTypesStr = await buildType(instructionInputTypes, { isInstructionString: true });
    let additionalDataInfoType = `\n\ntype ${
        convertPascal(config.projectName) + '_' + 'Data_Fields_Info'
    } {\n\tmessage: String\n},`;
    let typesStr = structTypesStr + enumTypesStr + additionalDataInfoType; /* + instructionInputTypesStr */

    let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr;

    let data = await readFile(typeDefTemplateFile, 'utf8');
    const split = data.split('///--------------------///');
    let codeString = split[0];
    codeString = codeString.concat(typeDefs);
    codeString = codeString.concat(split[1]);
    await writeFile(typeDefOutputFile, codeString);
}
