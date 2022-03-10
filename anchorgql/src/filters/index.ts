import { Idl, IdlField, IdlType, Operation } from '../types';
import * as config from '../config.json';
import {
    convertPascal,
    getGqlTypeForIdlScalarType,
    getKeyOrGQLTypeForIDLType,
    isDefinedTypeUsedInAccounts,
    getFilterTypeForField,
    getDefinedTypeOfArrayOrVectorField,
} from '../utils';
import { getBaseAggregateTypes } from '../aggregates_and_distincts';

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
            neq: '[String]',
            contains: 'String',
            doesNotContain: 'String',
            startsWith: 'String',
            endsWith: 'String',
            distinct: 'Boolean',
        },
    ];

    const stringValuesFilter: Operation = [
        convertPascal(projectName) + '_' + 'String_Values_Filters',
        {
            _values: convertPascal(projectName) + '_' + 'String_Filters',
        },
    ];

    const intFilter: Operation = [
        convertPascal(projectName) + '_' + 'Int_Filters',
        {
            eq: 'Int',
            neq: '[Int]',
            gt: 'Int',
            lt: 'Int',
            distinct: 'Boolean',
        },
    ];

    const intValuesFilter: Operation = [
        convertPascal(projectName) + '_' + 'Int_Values_Filters',
        {
            _values: convertPascal(projectName) + '_' + 'Int_Filters',
        },
    ];

    const bigIntFilter: Operation = [
        convertPascal(projectName) + '_' + 'BigInt_Filters',
        {
            eq: 'BigInt',
            neq: '[BigInt]',
            gt: 'BigInt',
            lt: 'BigInt',
            distinct: 'Boolean',
        },
    ];

    const bigIntValuesFilter: Operation = [
        convertPascal(projectName) + '_' + 'BigInt_Values_Filters',
        {
            _values: convertPascal(projectName) + '_' + 'BigInt_Filters',
        },
    ];

    const booleanFilter: Operation = [
        convertPascal(projectName) + '_' + 'Boolean_Filters',
        {
            eq: 'Boolean',
        },
    ];

    const booleanValuesFilter: Operation = [
        convertPascal(projectName) + '_' + 'Boolean_Values_Filters',
        {
            _values: convertPascal(projectName) + '_' + 'Boolean_Filters',
        },
    ];

    return [
        stringFilter,
        stringValuesFilter,
        intFilter,
        intValuesFilter,
        bigIntFilter,
        bigIntValuesFilter,
        booleanFilter,
        booleanValuesFilter,
    ];
}

/**
 * Get all the inputs required for to generate a filter for an object type. It
 * recursively finds all the object types in the fields of an object type and creates
 * a type for each nested object type
 * @param idlType The type for which filter inputs are to be generated
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Inputs for nested filters in {@link Operation} format
 */
function getFilterInputsForObjectType(idlType: IdlType, idlConfig: Idl): Operation[] {
    let objectTypes = [];
    if (typeof idlType === 'object' && 'defined' in idlType) {
        const typeDetails = idlConfig.types.filter((t) => t.name === idlType.defined)[0];
        if (typeDetails.type.kind === 'struct') {
            const fields = typeDetails.type.fields;
            const definedTypeFields = fields.filter(
                (f) =>
                    typeof f.type === 'object' &&
                    ('defined' in f.type ||
                        ('vec' in f.type && typeof f.type.vec === 'object' && 'defined' in f.type.vec) ||
                        ('option' in f.type && typeof f.type.option === 'object' && 'defined' in f.type.option) ||
                        ('coption' in f.type && typeof f.type.coption === 'object' && 'defined' in f.type.coption) ||
                        ('array' in f.type && typeof f.type.array[0] === 'object' && 'defined' in f.type.array[0])),
            );
            objectTypes = objectTypes.concat(definedTypeFields.map((df) => df.type));
            for (let a of definedTypeFields) {
                const nestedObjectTypes = getFilterInputsForObjectType(a.type, idlConfig);
                if (nestedObjectTypes.length > 0) {
                    objectTypes = objectTypes.concat(nestedObjectTypes);
                }
            }
        }
    } else if (typeof idlType === 'object' && ('array' in idlType || 'vec' in idlType)) {
        let typeDetails = null;
        if ('array' in idlType && typeof idlType['array'][0] === 'object' && 'defined' in idlType['array'][0]) {
            typeDetails = idlConfig.types.filter((t) => t.name === idlType.array[0]['defined'])[0];
        } else if ('vec' in idlType && typeof idlType['vec'] === 'object' && 'defined' in idlType['vec']) {
            typeDetails = idlConfig.types.filter((t) => t.name === idlType.vec['defined'])[0];
        }
        if (typeDetails) {
            if (typeDetails.type.kind === 'struct') {
                const fields = typeDetails.type.fields;
                const definedTypeFields = fields.filter(
                    (f) =>
                        typeof f.type === 'object' &&
                        (('vec' in f.type && typeof f.type.vec === 'object' && 'defined' in f.type.vec) ||
                            ('option' in f.type && typeof f.type.option === 'object' && 'defined' in f.type.option) ||
                            ('coption' in f.type &&
                                typeof f.type.coption === 'object' &&
                                'defined' in f.type.coption) ||
                            ('array' in f.type && typeof f.type.array[0] === 'object' && 'defined' in f.type.array[0])),
                );
                objectTypes = objectTypes.concat(definedTypeFields.map((df) => df.type));
                for (let a of definedTypeFields) {
                    const nestedObjectTypes = getFilterInputsForObjectType(a.type, idlConfig);
                    if (nestedObjectTypes.length > 0) {
                        objectTypes = objectTypes.concat(nestedObjectTypes);
                    }
                }
            }
        }
    }
    return objectTypes;
}

/**
 * Get filters for all accounts for the channel
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Filters for all accounts on the channel in {@link Operation} format
 */
export function getAccountFilterTypes(idlConfig: Idl): Operation[] {
    let projectName = config.projectName;
    const accounts = idlConfig.accounts;
    let nestedInputsToGenerate = [];
    let aggregateInputsToGenerate = [];
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
                            if (typeof field.type === 'object') {
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
                                } //else if (
                                //     Object.keys(field.type)[0] === 'array' ||
                                //     Object.keys(field.type)[0] === 'vec'
                                // ) {
                                //     if ('array' in field.type) {
                                //         const arrayDetails = field.type.array;
                                //         if (
                                //             typeof field.type.array[0] === 'object' &&
                                //             'defined' in field.type.array[0]
                                //         ) {
                                //             const definedTypeDetails = idlConfig.types.filter(
                                //                 (t) => t.name === field.type['array'][0].defined,
                                //             )[0];
                                //             if (definedTypeDetails.type.kind !== 'enum') {
                                //                 const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                                //                 fields.push({
                                //                     [field.name]:
                                //                         convertPascal(projectName) +
                                //                         '_' +
                                //                         account.name +
                                //                         '_' +
                                //                         field.name +
                                //                         '_Filters',
                                //                 });
                                //                 if (!nestedInputsToGenerate.includes(field.type)) {
                                //                     nestedInputsToGenerate.push(field.type);
                                //                 }
                                //                 // const additionalInputsToBeGenerated = getFilterInputsForObjectType(
                                //                 //     field.type,
                                //                 //     idlConfig,
                                //                 // );
                                //                 // nestedInputsToGenerate =
                                //                 //     nestedInputsToGenerate.concat(additionalInputsToBeGenerated);
                                //             }
                                //             const a = '';
                                //         }
                                //     }
                                // }
                            }
                        }
                    }
                }

                if (fields.length > 0) {
                    fields.push({
                        aggregate: convertPascal(projectName) + '_' + account.name + '_Account_Aggregate_Filters',
                    });
                    aggregateInputsToGenerate.push(account.name);
                    filters.push([
                        convertPascal(projectName) + '_' + account.name + '_Account_Filters',
                        Object.assign({}, ...fields),
                    ]);

                    filters.push([
                        convertPascal(projectName) + '_' + account.name + '_Filters',
                        {
                            publicKey: 'String',
                            account: convertPascal(projectName) + '_' + account.name + '_Account_Filters',
                        },
                    ]);
                }
                // If no filter was found for the account, then only generate one for it's public key
                else {
                    filters.push([
                        convertPascal(projectName) + '_' + account.name + '_Filters',
                        {
                            publicKey: 'String',
                        },
                    ]);
                }
            }
        }
    }

    const uniqueNestedObjects = [
        ...new Set(
            nestedInputsToGenerate.map((i) => {
                if ('defined' in i) {
                    return i.defined;
                } else if ('vec' in i && typeof i.vec === 'object' && 'defined' in i.vec) {
                    return i.vec.defined;
                } else if ('option' in i && typeof i.option === 'object' && 'defined' in i.option) {
                    return i.option.defined;
                } else if ('coption' in i && typeof i.coption === 'object' && 'defined' in i.coption) {
                    return i.coption.defined;
                } else if ('array' in i && typeof i.array[0] === 'object' && 'defined' in i.array[0]) {
                    return i.array[0].defined;
                }
            }),
        ),
    ];

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
    let baseAggregateFilterTypesToGenerate = [];
    const baseAggregateTypes = getBaseAggregateTypes();
    for (let a of aggregateInputsToGenerate) {
        const accountDetails = idlConfig.accounts.filter((ac) => ac.name === a)[0];
        if (accountDetails) {
            let fields = [];
            if (accountDetails.type.kind === 'struct') {
                const accountFields = accountDetails.type.fields;
                for (let field of accountFields) {
                    const fieldTypeStringified = field.type as string;
                    if (typeof fieldTypeStringified !== 'object') {
                        const scalarGQLType = getGqlTypeForIdlScalarType(field.type);
                        if (
                            scalarGQLType === 'Int' ||
                            scalarGQLType === 'BigInt' ||
                            scalarGQLType === 'String' ||
                            scalarGQLType === 'Boolean'
                        ) {
                            fields.push({
                                [field.name]: convertPascal(projectName) + '_' + scalarGQLType + '_Aggregate_Filter',
                            });
                        }

                        baseAggregateFilterTypesToGenerate.push(scalarGQLType);
                    }
                }
            }
            if (fields.length > 0) {
                filters.push([
                    convertPascal(projectName) + '_' + accountDetails.name + '_Account_Aggregate_Filters',
                    Object.assign({}, ...fields),
                ]);
            }
        }
    }

    for (let sType of [...new Set(baseAggregateFilterTypesToGenerate)]) {
        if (sType === 'Int' || sType === 'BigInt' || sType === 'String' || sType === 'Boolean') {
            const aggregateTypeDetails = baseAggregateTypes.filter(
                (b) => b[0] === convertPascal(projectName) + '_' + sType + '_Aggregates',
            )[0];
            let sFields = [];
            Object.entries(aggregateTypeDetails[1]).map(([k, v]) => {
                sFields.push({ [k]: v });
            });
            filters.push([
                convertPascal(projectName) + '_' + sType + '_Aggregate_Filter',
                Object.assign({}, ...sFields),
            ]);
        }
    }

    return filters;
}

/**
 * Get all the inputs required for to generate a filter for complex arrays.
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Inputs for complex array in {@link Operation} format
 */
export function getComplexArrayFilterTypes(idlConfig: Idl): Operation[] {
    let filters: Operation[] = [];

    let idlAccounts = idlConfig.accounts;
    if (idlAccounts) {
        for (let account of idlAccounts) {
            if (account.type.kind === 'struct') {
                const accountFields = account.type.fields;
                if (accountFields) {
                    for (let field of accountFields) {
                        const fieldTypeStringified = field.type as string;
                        if (typeof fieldTypeStringified === 'object') {
                            if (Object.keys(field.type)[0] === 'array' || Object.keys(field.type)[0] === 'vec') {
                                const key = getKeyOrGQLTypeForIDLType(field.type);
                                if (
                                    key !== '[String]' &&
                                    key !== '[Int]' &&
                                    key !== '[BigInt]' &&
                                    key !== '[Boolean]' &&
                                    key !== '[Byte]'
                                ) {
                                    let values = [];
                                    const filterTypeForField = getFilterTypeForField(key, account.name, field.name);
                                    const filterTypeDetails = getDefinedTypeOfArrayOrVectorField(field, idlConfig);
                                    if (
                                        filterTypeDetails.type.kind === 'struct' &&
                                        filterTypeDetails.type.fields?.length > 0
                                    ) {
                                        const filterFields = filterTypeDetails.type.fields;
                                        if (filterFields) {
                                            for (let field of filterFields) {
                                                if (typeof field.type === 'object') {
                                                    if ('array' in field.type) {
                                                        let key = getKeyOrGQLTypeForIDLType(field.type.array[0]);
                                                        if (
                                                            key !== '[String]' &&
                                                            key !== '[Int]' &&
                                                            key !== '[BigInt]' &&
                                                            key !== '[Boolean]' &&
                                                            key !== '[Byte]' &&
                                                            key !== 'String' &&
                                                            key !== 'Int' &&
                                                            key !== 'BigInt' &&
                                                            key !== 'Boolean' &&
                                                            key !== 'Byte'
                                                        ) {
                                                            key = getFilterTypeForField(
                                                                key,
                                                                filterTypeDetails.name,
                                                                field.name,
                                                            );
                                                        }
                                                        // if key isn't int or string or .. array, use the special name for it
                                                        values.push({ [field.name]: key });
                                                    } else if ('vec' in field.type) {
                                                        let key = getKeyOrGQLTypeForIDLType(field.type.vec);
                                                        if (
                                                            key !== '[String]' &&
                                                            key !== '[Int]' &&
                                                            key !== '[BigInt]' &&
                                                            key !== '[Boolean]' &&
                                                            key !== '[Byte]' &&
                                                            key !== 'String' &&
                                                            key !== 'Int' &&
                                                            key !== 'BigInt' &&
                                                            key !== 'Boolean' &&
                                                            key !== 'Byte'
                                                        ) {
                                                            key = getFilterTypeForField(
                                                                key,
                                                                filterTypeDetails.name,
                                                                field.name,
                                                            );
                                                        }
                                                        values.push({ [field.name]: key });
                                                    }
                                                } else {
                                                    const scalarGQLType = getGqlTypeForIdlScalarType(field.type);
                                                    values.push({
                                                        [field.name]: scalarGQLType,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    if (values.length > 0) {
                                        filters.push([filterTypeForField, Object.assign({}, ...values)]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const idlTypes = idlConfig.types;
    if (idlTypes?.length > 0) {
        idlTypes
            .filter((x) => x.type.kind === 'struct' && isDefinedTypeUsedInAccounts(x.name, idlConfig))
            .map((x) => {
                x.type.fields.map((y) => {
                    let key = getKeyOrGQLTypeForIDLType(y.type);
                    if (key.startsWith('[') && key.endsWith(']')) {
                        const filterTypeForField = getFilterTypeForField(key, x.name, y.name);
                        if (
                            key !== '[String]' &&
                            key !== '[Int]' &&
                            key !== '[BigInt]' &&
                            key !== '[Boolean]' &&
                            key !== '[Byte]'
                        ) {
                            let values = [];
                            const filterTypeDetails = getDefinedTypeOfArrayOrVectorField(y, idlConfig);
                            if (filterTypeDetails.type.kind === 'struct' && filterTypeDetails.type.fields?.length > 0) {
                                const filterFields = filterTypeDetails.type.fields;
                                if (filterFields) {
                                    for (let field of filterFields) {
                                        const fieldTypeStringified = field.type as string;
                                        if (typeof fieldTypeStringified !== 'object') {
                                            const scalarGQLType = getGqlTypeForIdlScalarType(field.type);
                                            values.push({
                                                [field.name]: scalarGQLType,
                                            });
                                        } else {
                                            if (Object.keys(field.type)[0] === 'defined') {
                                                const definedTypeDetails = idlConfig.types.filter(
                                                    (t) => t.name === field.type['defined'],
                                                )[0];
                                                if (definedTypeDetails.type.kind !== 'enum') {
                                                    const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                                                    values.push({ [field.name]: objectGqlType + '_Filters' });
                                                }
                                            } else if (typeof field.type === 'object' && 'array' in field.type) {
                                                if (
                                                    typeof field.type.array[0] === 'object' &&
                                                    'defined' in field.type.array[0]
                                                ) {
                                                    const definedTypeName = field.type.array[0].defined;
                                                    const definedTypeDetails = idlConfig.types.filter(
                                                        (t) => t.name === definedTypeName,
                                                    )[0];
                                                    if (definedTypeDetails.type.kind !== 'enum') {
                                                        const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                                                        values.push({ [field.name]: objectGqlType + '_Filters' });
                                                    }
                                                } else {
                                                    const scalarGQLType = getGqlTypeForIdlScalarType(
                                                        field.type.array[0],
                                                    );
                                                    values.push({ [field.name]: scalarGQLType });
                                                }
                                            } else if (
                                                typeof field.type === 'object' &&
                                                'vec' in field.type &&
                                                typeof field.type.vec === 'object' &&
                                                'defined' in field.type.vec
                                            ) {
                                                const definedTypeName = field.type.vec.defined;
                                                const definedTypeDetails = idlConfig.types.filter(
                                                    (t) => t.name === definedTypeName,
                                                )[0];
                                                if (definedTypeDetails.type.kind !== 'enum') {
                                                    const scalarGQLType = getGqlTypeForIdlScalarType(field.type.vec);
                                                    values.push({ [field.name]: scalarGQLType });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (values.length > 0) {
                                filters.push([filterTypeForField, Object.assign({}, ...values)]);
                            }
                        }
                    }
                });
            });
    }

    return filters;
}
