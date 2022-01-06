import {
    OperationType,
    OperationName,
    OpertationReturnType,
    IdlType,
    IdlTypeVec,
    IdlTypeOption,
    IdlTypeDefined,
    IdlTypeArray,
} from './types';
import * as config from './config.json';

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

export function isSpecialEnum(
    operation: [type: OperationType, options: Record<OperationName, OpertationReturnType>],
): boolean {
    return (
        Object.keys(operation).length === 2 &&
        Object.keys(operation[1]).includes('name') &&
        Object.keys(operation[1]).includes('data')
    );
}

export function convertPascal(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
