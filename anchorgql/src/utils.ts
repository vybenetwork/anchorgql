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

export const STRING_TYPES = ['bytes', 'string', 'publicKey'];
export const INT_TYPES = ['u8', 'i8', 'u16', 'i16', 'i32'];
export const BIG_INT_TYPES = ['u32', 'u64', 'i64', 'u128', 'i128'];

export function getKeyOrGQLTypeForIDLType(idlType: IdlType): string {
    if (idlType instanceof Object) {
        return getKeyForIdlObjectType(idlType);
    } else {
        return getGqlTypeForIdlScalarType(idlType);
    }
}

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

export function isSpecialEnum(operation: Operation): boolean {
    return (
        Object.keys(operation).length === 2 &&
        Object.keys(operation[1]).includes('name') &&
        Object.keys(operation[1]).includes('data')
    );
}

export function convertPascal(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function isFilterableType(typeName: string): boolean {
    return typeName !== 'String' && typeName !== 'Int' && typeName !== 'BigInt' && typeName !== 'Boolean';
}
