import { Idl, Operation } from '../types';
import { getAccountRootTypes, getAccountTypes, getQueryType, getRootType } from '../queries';
import { getEnumTypes, getStructTypes } from '../types/index';
import * as config from '../config.json';
import { convertPascal, isSpecialEnum } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import { getFilterInputsForBaseTypes, getAccountFilterTypes } from '../filters';

/**
 * Get an SDL compitable GraphQL Type/Input from the {@link Operation} type
 * @param mapping A list of types to convert from {@link Operations} type to an SDL compitable GraphQL type
 * @param options Additional options to control the type generated. The generated type will vary according to provided options.
 * @returns A GraphQL SDL compitable type in a string
 */
async function buildType(
    mapping: Operation[],
    options: {
        isQueryString?: boolean;
        isEnumString?: boolean;
        isInstructionString?: boolean;
        isInputString?: boolean;
    } = {
        isQueryString: false,
        isEnumString: false,
        isInstructionString: false,
        isInputString: false,
    },
): Promise<string> {
    if (mapping.length !== 0) {
        let stringType = mapping
            .filter((x) => Object.keys(x[1]).length > 0)
            .map((x) => {
                let returnType = `\n${options.isInstructionString || options.isInputString ? 'input' : 'type'} ${
                    x[0]
                } ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, '');
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
                // const projectName = config.projectName;
                // Generate input for filters
                // if (x.length === 3 && Object.keys(x[2]).length > 0) {
                //     // First going through the main list of filters
                //     for (let k of Object.keys(x[2])) {
                //         returnType += '\ninput ' + k + ' {';
                //         // For that filters, these are the properties which can be filtered
                //         for (let f of Object.keys(x[2][k])) {
                //             let fType = x[2][k][f];
                //             if (fType === 'String') {
                //                 returnType += '\n\t' + f + ': ' + convertPascal(projectName) + '_String_Filters';
                //             } else if (fType === 'Int') {
                //                 returnType += '\n\t' + f + ': ' + convertPascal(projectName) + '_Int_Filters';
                //             } else if (fType === 'BigInt') {
                //                 returnType += '\n\t' + f + ': ' + convertPascal(projectName) + '_BigInt_Filters';
                //             } else if (fType === 'Boolean') {
                //                 returnType += '\n\t' + f + ': ' + convertPascal(projectName) + '_Boolean_Filters';
                //             }
                //         }
                //         returnType += '\n} \n';
                //     }
                // }

                return returnType;
            });

        return stringType.join('');
    } else {
        return '';
    }
}

/**
 * A helper function to generate the GraphQL typedef file. It combines various methods from different modules to generate the SDL.
 * @param idlConfig The IDL File for the Smart Contract
 * @param typeDefTemplateFile Path to where the template file for typedefs is stored
 * @param typeDefOutputFile Path to where the output typedef file will be copied to
 */
export async function buildTypeDef(
    idlConfig: Idl,
    typeDefTemplateFile: string,
    typeDefOutputFile: string,
): Promise<void> {
    // First get all the types
    //let filterInputs = getFilterInputsForBaseTypes()
    let query = await getQueryType();
    let root = await getRootType(idlConfig);
    let accountRoot = await getAccountRootTypes(idlConfig);
    let account = await getAccountTypes(idlConfig);
    let structTypes = await getStructTypes(idlConfig);
    let enumTypes = await getEnumTypes(idlConfig);

    // Types for filters
    let baseInputFilters = getFilterInputsForBaseTypes();
    let accountFilterTypes = getAccountFilterTypes(idlConfig);

    // Process the types to create valid gql strings
    let queryStr = await buildType(query, { isQueryString: true });
    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let structTypesStr = await buildType(structTypes);
    let enumTypesStr = await buildType(enumTypes, { isEnumString: true });
    let additionalDataInfoType = `\n\ntype ${
        convertPascal(config.projectName) + '_' + 'Data_Fields_Info'
    } {\n\tmessage: String\n},`;
    let typesStr = structTypesStr + enumTypesStr + additionalDataInfoType; /* + instructionInputTypesStr */

    let baseFilterInputsStr = await buildType(baseInputFilters, { isInputString: true });
    let accountFilterInputsStr = await buildType(accountFilterTypes, { isInputString: true });
    let filtersStr = baseFilterInputsStr + accountFilterInputsStr;

    let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr + filtersStr;

    let data = await readFile(typeDefTemplateFile, 'utf8');
    const split = data.split('///--------------------///');
    let codeString = split[0];
    codeString = codeString.concat(typeDefs);
    codeString = codeString.concat(split[1]);
    await writeFile(typeDefOutputFile, codeString);
}
