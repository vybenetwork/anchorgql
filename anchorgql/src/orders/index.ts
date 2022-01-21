import { Idl, IdlField, IdlType, Operation } from '../types';
import * as config from '../config.json';
import { convertPascal, getGqlTypeForIdlScalarType, getKeyOrGQLTypeForIDLType } from '../utils';

/**
 * Get the base inputs order
 * @returns A valid GraphQL Input for base Order
 */
export function getBaseInputForOrders(): string {
    let projectName = config.projectName;
    return `
enum ${convertPascal(projectName) + '_SortOrders'} {
    ASC
    DESC
}

input ${convertPascal(projectName) + '_OrderBy'} {
    sortOrder: ${convertPascal(projectName) + '_SortOrders'}
}`;
}

/**
 * Get all the inputs required for to generate an order by type for an object type. It
 * recursively finds all the object types in the fields of an object type and creates
 * a type for each nested object type
 * @param idlType The type for which order by inputs are to be generated
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Inputs for nested order by types in {@link Operation} format
 */
function getOrderByInputsForObjectType(idlType: IdlType, idlConfig: Idl): Operation[] {
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
                const nestedObjectTypes = getOrderByInputsForObjectType(a.type, idlConfig);
                if (nestedObjectTypes.length > 0) {
                    objectTypes = objectTypes.concat(nestedObjectTypes);
                }
            }
        }
    }
    return objectTypes;
}

/**
 * Get sort order input types for all accounts for the channel
 * @param idlConfig The IDL File for the Smart Contract
 * @returns Sort Order types for all accounts on the channel in {@link Operation} format
 */
export function getAccountOrderByTypes(idlConfig: Idl): Operation[] {
    let projectName = config.projectName;
    const accounts = idlConfig.accounts;
    let nestedInputsToGenerate = [];
    let orderByTypes: Operation[] = [];

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
                            if (Object.keys(field.type)[0] === 'defined') {
                                const definedTypeDetails = idlConfig.types.filter(
                                    (t) => t.name === field.type['defined'],
                                )[0];
                                if (definedTypeDetails.type.kind !== 'enum') {
                                    const objectGqlType = getKeyOrGQLTypeForIDLType(field.type);
                                    fields.push({ [field.name]: objectGqlType + '_OrderBy' });
                                    if (!nestedInputsToGenerate.includes(field.type)) {
                                        nestedInputsToGenerate.push(field.type);
                                    }
                                    const additionalInputsToBeGenerated = getOrderByInputsForObjectType(
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
                if (fields.length > 0) {
                    orderByTypes.push([
                        convertPascal(projectName) + '_' + account.name + '_Account_OrderBy',
                        Object.assign({}, ...fields),
                    ]);

                    orderByTypes.push([
                        convertPascal(projectName) + '_' + account.name + '_OrderBy',
                        {
                            publicKey: 'String',
                            account: convertPascal(projectName) + '_' + account.name + '_Account_OrderBy',
                        },
                    ]);
                }
                // If no order by was found for the account, then only generate one for it's public key
                else {
                    orderByTypes.push([
                        convertPascal(projectName) + '_' + account.name + '_OrderBy',
                        {
                            publicKey: 'String',
                        },
                    ]);
                }
            }
        }
    }

    const uniqueNestedObjects = [...new Set(nestedInputsToGenerate.map((i) => Object.values(i)).map((v) => v[0]))];
    for (let nType of uniqueNestedObjects) {
        const typeDetails = idlConfig.types.filter((t) => t.name === nType)[0];
        const name = convertPascal(projectName) + '_' + nType + '_OrderBy';
        let values = [];
        values = typeDetails.type.fields.map((y: IdlField) => {
            if (typeof y.type !== 'object' || 'defined' in y.type) {
                let key = getKeyOrGQLTypeForIDLType(y.type);
                if (key !== 'String' && key !== 'Int' && key !== 'BigInt' && key !== 'Boolean') {
                    key += '_OrderBy';
                }
                return {
                    [y['name']]: key,
                };
            }
        });
        if (values.length > 0) {
            orderByTypes.push([name, Object.assign({}, ...values)]);
        }
    }

    return orderByTypes;
}
