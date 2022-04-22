import {
    IdlType,
    IdlTypeVec,
    IdlTypeOption,
    IdlTypeDefined,
    IdlTypeArray,
    Operation,
    IdlTypeCOption,
    Idl,
    IdlField,
    IdlTypeDef,
} from './types';
import * as config from './config.json';

/**
 * @constant
 * Rust Types correspoding to GraphQL's String type
 */
export const STRING_TYPES = ['string', 'publicKey'];

/**
 * @constant
 * Rust Types correspoding to GraphQL's Int type
 */
export const INT_TYPES = ['u8', 'i8', 'u16', 'i16', 'i32'];

/**
 * @constant
 * Rust Types correspoding to GraphQL's BigInt type
 */
export const BIG_INT_TYPES = ['u32', 'u64', 'i64', 'u128', 'i128'];

/**
 * The function takes any IDL type (object or scalar) and returns it's corresponding GraphQL type.
 * @param idlType The IDL type
 * @returns The GraphQL type for the IDL type
 */
export function getKeyOrGQLTypeForIDLType(idlType: IdlType): string {
    if (idlType instanceof Object) {
        return getKeyForIdlObjectType(idlType);
    } else {
        return getGqlTypeForIdlScalarType(idlType);
    }
}

/**
 * Check if a type name is one of the scalar types
 * @param typeName The GraphQL type name
 * @returns If the type name is one of the scalar types
 */
export function isTypeScalarType(typeName: string): boolean {
    return (
        typeName === 'String' ||
        typeName === 'Int' ||
        typeName === 'BigInt' ||
        typeName === 'Boolean' ||
        typeName === 'Byte'
    );
}

/**
 * Check if a type name is an array of the scalar types
 * @param typeName The GraphQL type name
 * @returns If the type name is an array of the scalar types
 */
export function isTypeArrayOfScalarTypes(typeName: string): boolean {
    return (
        typeName === '[String]' ||
        typeName === '[Int]' ||
        typeName === '[BigInt]' ||
        typeName === '[Boolean]' ||
        typeName === '[Byte]'
    );
}

/**
 * Check if a type name is a scalar type or an array of the scalar types
 * @param typeName The GraphQL type name
 * @returns If the type name is a scalar type an array of the scalar types
 */
export function isTypeScalarOrArrayOfScalarType(typeName: string): boolean {
    return isTypeScalarType(typeName) || isTypeArrayOfScalarTypes(typeName);
}

/**
 * The function takes an IDL object type and returns it's corresponding GraphQL type.
 * This should only be used for object types and not for scalar types.
 * @param idlObjectType The IDL type
 * @returns The GraphQL type for the IDL type
 */
export function getKeyForIdlObjectType(
    idlObjectType: IdlTypeVec | IdlTypeOption | IdlTypeDefined | IdlTypeArray | IdlTypeCOption,
): string {
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
    } else if ('coption' in idlObjectType) {
        key = convertPascal(projectName) + '_' + idlObjectType.coption;
    } else {
        throw 'An unsupported object type was encountered in the IDL by the indexer.';
    }
    return key;
}

/**
 * The function takes an IDL scalar type and returns it's corresponding GraphQL type.
 * This should only be used for scalar types and not for object types.
 * @param idlType The IDL type
 * @returns The GraphQL type for the IDL type
 */
export function getGqlTypeForIdlScalarType(idlType: IdlType): string {
    const idlTypeStringified = idlType as string;

    if (STRING_TYPES.includes(idlTypeStringified)) {
        return 'String';
    } else if (INT_TYPES.includes(idlTypeStringified)) {
        return 'Int';
    } else if (BIG_INT_TYPES.includes(idlTypeStringified)) {
        return 'BigInt';
    } else if (idlTypeStringified === 'bool') {
        return 'Boolean';
    } else if (idlTypeStringified === 'bytes') {
        return 'Byte';
    } else {
        throw 'An unsupported scalar type was encountered in the IDL by the indexer.';
    }
}

/**
 * For enums containing fields in them, the type generated in the {@link Operation} type has a special structure which other parts of code depend upon.
 * This method checks whether the {@link Operation} type is a special enum type
 * @param operation The type to check
 * @returns Whether the type is a special enum type or not
 */
export function isSpecialEnum(operation: Operation): boolean {
    return (
        Object.keys(operation).length === 2 &&
        Object.keys(operation[1]).includes('name') &&
        Object.keys(operation[1]).includes('data')
    );
}

/**
 * Convert a string to Pascal Case
 * @param value The string to convert to pascal case
 * @returns The string in the parameter converted to pascal case
 */
export function convertPascal(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Turn a string to camel case
 * @param str The string to convert to camel case
 * @returns The input string converted to camel case
 */
export function camelCase(str: string) {
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}

/**
 * Recursively finds all the defined types in an {@link IdlField}
 * @param idlField The field for which defined types are to be returned
 * @param idlConfig The IDL File for the Smart Contract
 * @returns An array of all defined types in an {@link IdlField}
 */
function getDefinedTypesNestedInADefinedTypeField(idlField: IdlField | IdlType, idlConfig: Idl): IdlField[] {
    let definedTypes = [];
    let definedFieldTypeName = '';
    // type is IDL Field
    if (typeof idlField === 'object' && 'name' in idlField && 'type' in idlField) {
        if (!(typeof idlField.type === 'object')) {
            return [];
        }
        if ('defined' in idlField.type) {
            definedFieldTypeName = idlField.type.defined;
        } else if (
            'array' in idlField.type &&
            typeof idlField.type.array[0] === 'object' &&
            'defined' in idlField.type.array[0]
        ) {
            definedFieldTypeName = idlField.type.array[0].defined;
            const typeDetails = idlConfig.types.filter((t) => t.name === definedFieldTypeName)[0];
            definedTypes = definedTypes.concat(typeDetails);
        } else if ('vec' in idlField.type && typeof idlField.type.vec === 'object' && 'defined' in idlField.type.vec) {
            definedFieldTypeName = idlField.type.vec.defined;
            const typeDetails = idlConfig.types.filter((t) => t.name === definedFieldTypeName)[0];
            definedTypes = definedTypes.concat(typeDetails);
        } else {
            return [];
        }
    } else {
        if (!(typeof idlField === 'object') || !('defined' in idlField)) {
            return [];
        }
        definedFieldTypeName = idlField.defined;
    }

    const typeDetails = idlConfig.types.filter((t) => t.name === definedFieldTypeName)[0];
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
        definedTypes = definedTypes.concat(definedTypeFields.map((df) => df));
        for (let a of definedTypeFields) {
            const nestedDefinedTypes = getDefinedTypesNestedInADefinedTypeField(a, idlConfig);
            if (nestedDefinedTypes.length > 0) {
                definedTypes = definedTypes.concat(nestedDefinedTypes);
            }
        }
    }
    return definedTypes;
}

/**
 * The function takes the type for a field on an account and checks if a type with a name
 * is used in it or any of it's children. All aggregate types and object types including
 * option and coption are searched for to see if a match can be located
 * @param field The account field type
 * @param typeName The name of type to search for
 * @param idlConfig The IDL object for the program
 * @returns Whether the type with the provided name is used in any other type in the provided
 * field
 */
export function definedTypeNameUsedInAnAccountField(field: IdlType, typeName: string, idlConfig: Idl): boolean {
    if (typeof field === 'object' && 'defined' in field) {
        if (field.defined === typeName) {
            return true;
        }
        const nestedDefinedTypesToCheck = getDefinedTypesNestedInADefinedTypeField(field, idlConfig);
        if (
            nestedDefinedTypesToCheck.some(
                (n) =>
                    typeof n.type === 'object' &&
                    (('defined' in n.type && n.type.defined === typeName) ||
                        ('array' in n.type &&
                            typeof n.type.array[0] === 'object' &&
                            'defined' in n.type.array[0] &&
                            n.type.array[0].defined === typeName) ||
                        ('vec' in n.type &&
                            typeof n.type.vec === 'object' &&
                            'defined' in n.type.vec &&
                            n.type.vec.defined === typeName)),
            )
        ) {
            return true;
        }
    } else if (typeof field === 'object' && 'vec' in field) {
        if (typeof field.vec === 'object' && 'defined' in field.vec) {
            if (field.vec.defined === typeName) {
                return true;
            }
            const nestedDefinedTypesToCheck = getDefinedTypesNestedInADefinedTypeField(field.vec, idlConfig);
            if (
                nestedDefinedTypesToCheck.some(
                    (f) =>
                        typeof f.type === 'object' &&
                        (('defined' in f.type && f.type.defined === typeName) ||
                            ('vec' in f.type && typeof f.type.vec === 'object' && 'defined' in f.type.vec) ||
                            ('option' in f.type && typeof f.type.option === 'object' && 'defined' in f.type.option) ||
                            ('coption' in f.type &&
                                typeof f.type.coption === 'object' &&
                                'defined' in f.type.coption) ||
                            ('array' in f.type && typeof f.type.array[0] === 'object' && 'defined' in f.type.array[0])),
                )
            ) {
                return true;
            }
        }
    } else if (typeof field === 'object' && 'array' in field) {
        if (typeof field.array[0] === 'object' && 'defined' in field.array[0]) {
            if (field.array[0].defined === typeName) {
                return true;
            }
            const nestedDefinedTypesToCheck = getDefinedTypesNestedInADefinedTypeField(field.array[0], idlConfig);
            if (
                nestedDefinedTypesToCheck.some(
                    (n) => typeof n.type === 'object' && 'defined' in n.type && n.type.defined === typeName,
                )
            ) {
                return true;
            }
        }
    } else if (typeof field === 'object' && 'option' in field) {
        if (typeof field.option === 'object' && 'defined' in field.option) {
            if (field.option.defined === typeName) {
                return true;
            }
            const nestedDefinedTypesToCheck = getDefinedTypesNestedInADefinedTypeField(field.option, idlConfig);
            if (
                nestedDefinedTypesToCheck.some(
                    (n) => typeof n.type === 'object' && 'defined' in n.type && n.type.defined === typeName,
                )
            ) {
                return true;
            }
        }
    } else if (typeof field === 'object' && 'coption' in field) {
        if (typeof field.coption === 'object' && 'defined' in field.coption) {
            if (field.coption.defined === typeName) {
                return true;
            }
            const nestedDefinedTypesToCheck = getDefinedTypesNestedInADefinedTypeField(field.coption, idlConfig);
            if (
                nestedDefinedTypesToCheck.some(
                    (n) => typeof n.type === 'object' && 'defined' in n.type && n.type.defined === typeName,
                )
            ) {
                return true;
            }
        }
    }
}

/**
 * Checks whether a defined type is used within an account
 * @param typeName The name of the defined type
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Whether the type name is used in an account or not
 */
export function isDefinedTypeUsedInAccounts(typeName: string, idlConfig: Idl): boolean {
    const structAccountFields = idlConfig.accounts.filter((x) => x.type.kind === 'struct').map((a) => a.type.fields);
    for (let accountFields of structAccountFields) {
        for (let field of accountFields) {
            if (definedTypeNameUsedInAnAccountField(field.type, typeName, idlConfig)) {
                return true;
            }
        }
    }

    const enumAccountVariants = idlConfig.accounts.filter((x) => x.type.kind === 'enum').map((x) => x.type.variants);
    for (let accountVariants of enumAccountVariants) {
        for (let variant of accountVariants) {
            const variantFields = variant.fields;
            for (let field of variantFields) {
                // type is IdlField
                if (typeof field === 'object' && 'name' in field && 'type' in field) {
                    if (definedTypeNameUsedInAnAccountField(field.type, typeName, idlConfig)) {
                        return true;
                    }
                }
                // type is IdlType
                else {
                    if (definedTypeNameUsedInAnAccountField(field, typeName, idlConfig)) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Generates a type for a filter depending upon the passed value for key
 * @param key The key for the type generated using {@link getKeyForIdlObjectType},
 * {@link getKeyOrGQLTypeForIDLType} or {@link getGqlTypeForIdlScalarType}
 * @param typeName The name of the parent type on which the field exists
 * @param fieldName The name of the field itself
 * @returns The name of the filter for the field
 */
export function getFilterTypeForField(key: string, typeName: string, fieldName: string): string {
    let projectName = config.projectName;
    if (key === '[String]') {
        return convertPascal(projectName) + '_' + 'String_Values_Filters';
    } else if (key === '[Int]') {
        return convertPascal(projectName) + '_' + 'Int_Values_Filters';
    } else if (key === '[BigInt]') {
        return convertPascal(projectName) + '_' + 'BigInt_Values_Filters';
    } else if (key === '[Boolean]') {
        return convertPascal(projectName) + '_' + 'Boolean_Values_Filters';
    } else if (key === '[Byte]') {
        return convertPascal(projectName) + '_' + 'Byte_Values_Filters';
    } else {
        return `${convertPascal(projectName)}_${typeName}_${fieldName}_Filters`;
    }
}

/**
 * Takes an array or vec type and returns the type details for a defined type if one is used
 * in the compound type and a null otherwise
 * @param field The vec or array type to get the defined type from
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Type details for the defined type if one exists in vec or array type, null otherwise
 */
export function getDefinedTypeOfArrayOrVectorField(field: IdlField, idlConfig: Idl): IdlTypeDef | null {
    let typeName = '';
    if (
        typeof field.type === 'object' &&
        'array' in field.type &&
        typeof field.type.array[0] === 'object' &&
        'defined' in field.type.array[0]
    ) {
        typeName = field.type.array[0].defined;
    } else if (
        typeof field.type === 'object' &&
        'vec' in field.type &&
        typeof field.type.vec === 'object' &&
        'defined' in field.type.vec
    ) {
        typeName = field.type.vec.defined;
    }

    if (typeName === '' || !idlConfig.types) {
        return null;
    }
    const typeDetails = idlConfig.types.filter((t) => t.name === typeName)[0];
    return typeDetails;
}

/**
 * Given an aggregate field of scalar values, the function returns the
 * corresponding filter input name for that aggregate
 * @param key The GraphQL type name as generated by {@link getKeyOrGQLTypeForIDLType} function
 * @returns The aggregate filter input name for the provided type name
 */
export function getAggregateTypeForField(key: string): string | null {
    let projectName = config.projectName;
    if (key === '[String]') {
        return convertPascal(projectName) + '_' + 'String_Values_Filters';
    } else if (key === '[Int]') {
        return convertPascal(projectName) + '_' + 'Int_Values_Filters';
    } else if (key === '[BigInt]') {
        return convertPascal(projectName) + '_' + 'BigInt_Values_Filters';
    } else if (key === '[Boolean]') {
        return convertPascal(projectName) + '_' + 'Boolean_Values_Filters';
    } else {
        return null;
    }
}

/**
 * The function checks if a filter should be generated for an account or not.
 * Filters are only supported currently for accounts which have some scalar field under them
 * or any of their complex fields have some scalar fields under them.
 * @param account The type definition of the account for which to check
 * @param idlConfig The IDL for the program
 * @returns Whether a filter should be generated or not for the account
 */
export function shouldGenerateFilterForAnAccount(account: IdlTypeDef, idlConfig: Idl): boolean {
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
                    if (Object.keys(field.type)[0] === 'defined') {
                        const definedTypeDetails = idlConfig.types.filter((t) => t.name === field.type['defined'])[0];
                        if (definedTypeDetails.type.kind !== 'enum') {
                            const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                            fields.push({ [field.name]: objectGqlType + '_Filters' });
                        }
                    }
                }
            }
        }
    }
    if (fields.length > 0) {
        return true;
    }
    return false;
}
