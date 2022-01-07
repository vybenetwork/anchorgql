import {
    IdlType,
    IdlTypeVec,
    IdlTypeOption,
    IdlTypeDefined,
    IdlTypeArray,
    Operation,
    IdlTypeDefTy,
    OperationArguments,
} from './types';
import * as config from './config.json';

/**
 * @constant
 * Rust Types correspoding to GraphQL's String type
 */
export const STRING_TYPES = ['bytes', 'string', 'publicKey'];

/**
 * @constant
 * Rust Types correspoding to GraphQL's Int type
 */
export const INT_TYPES = ['u8', 'i8', 'u16', 'i16', 'i32'];

/**
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
 * The function takes an IDL object type and returns it's corresponding GraphQL type.
 * This should only be used for object types and not for scalar types.
 * @param idlType The IDL type
 * @returns The GraphQL type for the IDL type
 */
export function getKeyForIdlObjectType(
    idlObjectType: IdlTypeVec | IdlTypeOption | IdlTypeDefined | IdlTypeArray,
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
    } else {
        throw 'An unsupported scalar type was encountered in the IDL by the indexer.';
    }
}

/**
 *
 * @param idlType The function takes a type and returns the fiields which can be filtered on that type with their GraphQL types
 * @returns The filters for a GraphQL type
 */
export function getFiltersForIDLType(idlType: IdlTypeDefTy): OperationArguments[] {
    let args = [];
    if (idlType.fields) {
        for (let f of idlType.fields) {
            let arg = null;
            const fieldTypeStringified = f.type as string;
            if (typeof fieldTypeStringified !== 'object') {
                if (STRING_TYPES.includes(fieldTypeStringified)) {
                    arg = { [f.name]: 'String' };
                } else if (INT_TYPES.includes(fieldTypeStringified)) {
                    arg = { [f.name]: 'Int' };
                } else if (BIG_INT_TYPES.includes(fieldTypeStringified)) {
                    arg = { [f.name]: 'BigInt' };
                } else if (f.type === 'bool') {
                    arg = { [f.name]: 'Boolean' };
                }
                if (arg) {
                    args.push(arg);
                }
            }
        }
    }
    return args;
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
 * Takes a type name and returns if the indexer support filtering for it. The indexer only support filtering on object types
 * @param typeName The type to check
 * @returns Whether the type is filterable
 */
export function isFilterableType(typeName: string): boolean {
    return typeName !== 'String' && typeName !== 'Int' && typeName !== 'BigInt' && typeName !== 'Boolean';
}
