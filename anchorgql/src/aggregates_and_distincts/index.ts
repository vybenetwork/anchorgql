import { Idl, IdlField, IdlType, Operation } from '../types';
import * as config from '../config.json';
import { convertPascal, getGqlTypeForIdlScalarType } from '../utils';

/**
 * Get the types for aggregates for different types
 * @returns Types for aggregates for different types in {@link Operation} format
 */
export function getBaseAggregateTypes(): Operation[] {
    let projectName = config.projectName;
    const stringAggregates: Operation = [
        convertPascal(projectName) + '_' + 'String_Aggregates',
        {
            count: 'Int',
        },
    ];

    const intAggregates: Operation = [
        convertPascal(projectName) + '_' + 'Int_Aggregates',
        {
            count: 'Int',
            min: 'Int',
            max: 'Int',
            average: 'Float',
        },
    ];

    const bigIntAggregates: Operation = [
        convertPascal(projectName) + '_' + 'BigInt_Aggregates',
        {
            count: 'Int',
            min: 'BigInt',
            max: 'BigInt',
            average: 'String',
        },
    ];

    const booleanAggregates: Operation = [
        convertPascal(projectName) + '_' + 'Boolean_Aggregates',
        {
            count: 'Int',
        },
    ];

    return [stringAggregates, intAggregates, bigIntAggregates, booleanAggregates];
}

export function getAccountAggregateTypes(idlConfig: Idl): Operation[] {
    let projectName = config.projectName;
    const accounts = idlConfig.accounts;
    let aggregates: Operation[] = [];
    if (accounts) {
        for (let account of accounts) {
            let fields = [];
            if (account.type.kind === 'struct') {
                const accountFields = account.type.fields;
                for (let field of accountFields) {
                    const fieldTypeStringified = field.type as string;
                    if (typeof fieldTypeStringified !== 'object') {
                        const scalarGQLType = getGqlTypeForIdlScalarType(field.type);
                        fields.push({ [field.name]: scalarGQLType });
                    }
                }
            }
            if (fields.length > 0) {
                aggregates.push([
                    convertPascal(projectName) + '_' + account.name + '_Account_Aggregates',
                    Object.assign({}, ...fields),
                ]);
            }
        }
    }
    return aggregates;
}
