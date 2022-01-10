import { Idl, IdlField, IdlType, Operation } from '../types';
import * as config from '../config.json';
import { convertPascal, getGqlTypeForIdlScalarType, getKeyForIdlObjectType, getKeyOrGQLTypeForIDLType } from '../utils';

/**
 * Get the inputs for filters for different types
 * @returns Inputs for Filters in {@link Operation} format
 */
export function getFilterInputsForBaseTypes(): Operation[] {
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

function getFilterInputsForObjectType(idlType: IdlType, idlConfig: Idl): Operation[] {
    let objectTypes = [];
    if (typeof idlType === 'object' && 'defined' in idlType) {
        const typeDetails = idlConfig.types.filter((t) => t.name === idlType.defined)[0];
        if (typeDetails.type.kind === 'struct') {
            const fields = typeDetails.type.fields;
            const definedTypeFields = fields.filter((f) => typeof f.type === 'object' && 'defined' in f.type);
            objectTypes = objectTypes.concat(definedTypeFields.map((df) => df.type));
            for (let a of definedTypeFields) {
                const nestedObjectTypes = getFilterInputsForObjectType(a.type, idlConfig);
                if (nestedObjectTypes.length > 0) {
                    objectTypes = objectTypes.concat(nestedObjectTypes);
                }
            }
        }
    }
    return objectTypes;
}

export function getAccountFilterTypes(idlConfig: Idl): Operation[] {
    let projectName = config.projectName;
    const accounts = idlConfig.accounts;
    let nestedInputsToGenerate = [];
    let filters: Operation[] = [];
    if (accounts) {
        for (let account of accounts) {
            let fields = [];
            if (account.type.kind === 'struct') {
                const accountFields = account.type.fields;
                if (accountFields) {
                    for (let field of accountFields) {
                        const fieldTypeStringified = field.type as string;
                        if (typeof fieldTypeStringified !== 'object') {
                            const scalarGQLType = getGqlTypeForIdlScalarType(field.type);
                            fields.push({ [field.name]: scalarGQLType });
                        } else {
                            //const filterInputsForType = getFilterInputsForObjectType(field.type);
                            if (Object.keys(field.type)[0] === 'defined') {
                                const definedTypeDetails = idlConfig.types.filter(
                                    (t) => t.name === field.type['defined'],
                                )[0];
                                if (definedTypeDetails.type.kind !== 'enum') {
                                    const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                                    fields.push({ [field.name]: objectGqlType + '_Filters' });
                                    if (!nestedInputsToGenerate.includes(field.type)) {
                                        nestedInputsToGenerate.push(field.type);
                                    }
                                    const additionalInputsToBeGenerated = getFilterInputsForObjectType(
                                        field.type,
                                        idlConfig,
                                    );
                                    nestedInputsToGenerate =
                                        nestedInputsToGenerate.concat(additionalInputsToBeGenerated);
                                }
                            }
                        }
                    }
                }
                filters.push([
                    convertPascal(projectName) + '_' + account.name + '_Filters',
                    Object.assign({}, ...fields),
                ]);
            }
        }
    }

    const uniqueNestedObjects = [...new Set(nestedInputsToGenerate.map((i) => Object.values(i)).map((v) => v[0]))];
    for (let nType of uniqueNestedObjects) {
        const typeDetails = idlConfig.types.filter((t) => t.name === nType)[0];
        const name = convertPascal(projectName) + '_' + nType + '_Filters';
        let values = [];
        values = typeDetails.type.fields.map((y: IdlField) => {
            if (typeof y.type !== 'object' || 'defined' in y.type) {
                let key = getKeyOrGQLTypeForIDLType(y.type);
                if (key !== 'String' && key !== 'Int' && key !== 'BigInt' && key !== 'Boolean') {
                    key += '_Filters';
                }
                return {
                    [y['name']]: key,
                };
            }
        });
        if (values.length > 0) {
            filters.push([name, Object.assign({}, ...values)]);
        }
    }

    return filters;
}
