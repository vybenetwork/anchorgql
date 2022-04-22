import { Idl, Operation } from '../types';
import { getAccountRootTypes, getAccountTypes, getQueryType, getRootType } from '../queries';
import { getEnumTypes, getStructTypes } from '../types/index';
import * as config from '../config.json';
import { convertPascal, isSpecialEnum, isTypeScalarType } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import { getFilterInputsForBaseTypes, getAccountFilterTypes, getComplexArrayFilterTypes } from '../filters';
import { getAccountOrderByTypes, getBaseInputForOrders } from '../orders';
import { getAccountAggregateTypes, getBaseAggregateTypes } from '../aggregates_and_distincts';

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
                return returnType;
            });

        return stringType.join('');
    } else {
        return '';
    }
}

/**
 * Generates GraphQL Input types for filters on accounts
 * @param mapping A list of types to convert from {@link Operations} type to an SDL compitable GraphQL type
 * @returns A GraphQL compitable input types string
 */
export function buildTypeForFilters(mapping: Operation[]): string {
    if (mapping.length > 0) {
        const projectName = config.projectName;
        let stringType = mapping.map((x) => {
            if (Object.keys(x[1]).length > 0) {
                let returnType = `\ninput ${x[0]} {`;
                for (let k of Object.keys(x[1])) {
                    let fType = x[1][k];
                    if (fType === 'String') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_String_Filters';
                    } else if (fType === 'Int') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_Int_Filters';
                    } else if (fType === 'BigInt') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_BigInt_Filters';
                    } else if (fType === 'Boolean') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_Boolean_Filters';
                    } else {
                        returnType += '\n\t' + k + ': ' + x[1][k];
                    }
                }
                returnType += '\n} \n';
                return returnType;
            }
        });
        return stringType.join('\n');
    }

    return;
}

/**
 * Generates GraphQL Input types for order bys on accounts
 * @param mapping A list of types to convert from {@link Operations} type to an SDL compitable GraphQL type
 * @returns A GraphQL compitable input types string
 */
export function buildTypeForOrderBy(mapping: Operation[]): string {
    if (mapping.length > 0) {
        const projectName = config.projectName;
        let stringType = mapping.map((x) => {
            if (Object.keys(x[1]).length > 0) {
                let returnType = `\ninput ${x[0]} {`;
                for (let k of Object.keys(x[1])) {
                    let fType = x[1][k];
                    if (isTypeScalarType(fType) && fType !== 'Byte') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_OrderBy';
                    } else {
                        returnType += '\n\t' + k + ': ' + x[1][k];
                    }
                }
                returnType += '\n} \n';
                return returnType;
            }
        });
        return stringType.join('\n');
    }

    return;
}

/**
 * Get a string for an enum for account names for the program
 * @param idlConfig The IDL File for the Smart Contract
 * @returns A valid GraphQL enum for all accounts for the program
 */
function getEnumStringForAccounts(idlConfig: Idl): string {
    const projectName = config.projectName;
    let returnString = `\nenum ${convertPascal(projectName)}_Account_Names {\n`;
    if (idlConfig.accounts && idlConfig.accounts.length > 0) {
        idlConfig.accounts.map((a) => {
            returnString += '\t' + a.name + '\n';
        });
        returnString += '}\n';
        return returnString;
    } else return null;
}

/**
 * Generates GraphQL SDL type for a list of type mappings for aggregations
 * @param mapping A list of types to convert from {@link Operations} type to an SDL compitable GraphQL type
 * @returns
 */
export function buildTypeForAggregates(mapping: Operation[]): string {
    if (mapping.length > 0) {
        const projectName = config.projectName;
        let stringType = mapping.map((x) => {
            if (Object.keys(x[1]).length > 0) {
                let returnType = `\ntype ${x[0]} {`;
                for (let k of Object.keys(x[1])) {
                    let fType = x[1][k];
                    if (fType === 'String') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_String_Aggregates';
                    } else if (fType === 'Int') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_Int_Aggregates';
                    } else if (fType === 'BigInt') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_BigInt_Aggregates';
                    } else if (fType === 'Boolean') {
                        returnType += '\n\t' + k + ': ' + convertPascal(projectName) + '_Boolean_Aggregates';
                    }
                }
                returnType += '\n} \n';
                return returnType;
            }
        });
        return stringType.join('\n');
    }

    return;
}

/**
 * Get the string for utilities for the program
 * @returns A valid GraphQL string for utility methods for the API
 */
function getUtilsTypeString(): string {
    const projectName = config.projectName;
    const returnString = `\ntype ${
        convertPascal(projectName) + '_Utils'
    } {\n\t decodeAccountData(account: ${convertPascal(projectName)}_Account_Names data: String): JSON\n}`;
    return returnString;
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
    let complexArrayFilterTypes = getComplexArrayFilterTypes(idlConfig);

    // Type for Orders
    let accountOrderByTypes = getAccountOrderByTypes(idlConfig);

    // Types for aggregates
    let baseAggregateTypes = getBaseAggregateTypes();
    let accountAggregateTypes = getAccountAggregateTypes(idlConfig);

    // Process the types to create valid gql strings
    let queryStr = await buildType(query, { isQueryString: true });
    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let structTypesStr = await buildType(structTypes);
    let enumTypesStr = await buildType(enumTypes, { isEnumString: true });
    let enumAccountsStr = getEnumStringForAccounts(idlConfig);
    let programsUtilsString = getUtilsTypeString();
    let additionalDataInfoType = `\n\ntype ${
        convertPascal(config.projectName) + '_' + 'Data_Fields_Info'
    } {\n\tmessage: String\n}\n`;
    let typesStr = structTypesStr + enumTypesStr + additionalDataInfoType + enumAccountsStr + programsUtilsString;

    let baseFilterInputsStr = await buildType(baseInputFilters, { isInputString: true });
    let accountFilterInputsStr = buildTypeForFilters(accountFilterTypes);

    let complexArrayFilterInputsStr = '';
    if (complexArrayFilterTypes.length > 0) {
        complexArrayFilterInputsStr = buildTypeForFilters(complexArrayFilterTypes);
    }
    let filtersStr = baseFilterInputsStr + accountFilterInputsStr + complexArrayFilterInputsStr;

    let baseOrderInputStr = getBaseInputForOrders();
    let orderByInputStr = buildTypeForOrderBy(accountOrderByTypes);
    let orderStr = baseOrderInputStr + orderByInputStr;

    let baseAggregatesTypesStr = await buildType(baseAggregateTypes);
    let accountAggregatesTypesStr = buildTypeForAggregates(accountAggregateTypes);

    let aggregatesStr = baseAggregatesTypesStr + accountAggregatesTypesStr;

    let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr + filtersStr + orderStr + aggregatesStr;

    let data = await readFile(typeDefTemplateFile, 'utf8');
    const split = data.split('///--------------------///');
    let codeString = split[0];
    codeString = codeString.concat(typeDefs);
    codeString = codeString.concat(split[1]);
    await writeFile(typeDefOutputFile, codeString);
}
