import { camelCase } from 'lodash';
import * as config from '../config.json';
import { Idl, IdlField, IdlType, IdlTypeDef, Operation } from '../types';
import { convertPascal, getGqlTypeForIdlScalarType, getKeyForIdlObjectType, getKeyOrGQLTypeForIDLType } from '../utils';

/**
 * Get types for all struct types in the IDL
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The fields for all the struct types in the IDL in the {@link Operation} type
 */
export async function getStructTypes(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let typeArr: Operation[] = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        let idlStructTypes = idlTypes.filter((x) => x.type.kind === 'struct');
        for (let x of idlStructTypes) {
            let name: string = convertPascal(projectName) + '_' + x.name;
            let values = [];
            values = x.type.fields.map((y: IdlField) => {
                let key = getKeyOrGQLTypeForIDLType(y.type);
                return {
                    [y['name']]: key,
                };
            });
            //let filters = getFiltersForIDLType(x.type);
            if (values.length > 0) {
                typeArr.push([name, Object.assign({}, ...values)]);
            }
        }
    }
    return typeArr;
}

//#region Enums

/**
 * Get types for all enum types in the IDL. Enum types are special types to accomodate
 * the possibility of enum types containing fields in them in Rust. This is a
 * special type which contains an enum for all the variants and a union type for fields
 * on each of the variant.
 * @param idlConfig The IDL File for the Smart Contract
 * @returns The types for all the enum types in the IDL in the {@link Operation} type
 */
export async function getEnumTypes(idlConfig: Idl): Promise<Operation[]> {
    let projectName = config.projectName;
    let typeArr: Operation[] = [];
    if (idlConfig.hasOwnProperty('types')) {
        let idlTypes: IdlTypeDef[] = idlConfig.types;
        let idlEnumTypes = idlTypes.filter((x) => x.type.kind === 'enum');
        for (let x of idlEnumTypes) {
            let enumVariants = x.type.variants;
            let variantsWithFields = [];
            // first generate types for all the variants with fields in them
            let enumVariantNames = [];
            enumVariants.map((e) => {
                enumVariantNames.push(e.name);
                if ('fields' in e) {
                    let name = e.name;
                    let values = e.fields.map((z: IdlField | IdlType) => {
                        if (z instanceof Object) {
                            const castedIdlField = z as IdlField;
                            return {
                                [camelCase(castedIdlField.name)]: getKeyOrGQLTypeForIDLType(castedIdlField.type),
                            };
                        } else {
                            return {
                                [camelCase(z)]: getKeyOrGQLTypeForIDLType(z),
                            };
                        }
                    });
                    const typeName = convertPascal(projectName) + '_' + name;
                    typeArr.push([typeName, Object.assign({}, ...values)]);
                    variantsWithFields.push(typeName);
                }
            });

            // The implementation of buildType for enums depends on this. Edit with Caution

            const typeNameForDataFieldInfoType = convertPascal(projectName) + '_' + 'Data_Fields_Info';

            typeArr.push([
                convertPascal(projectName) + '_' + x.name,
                {
                    name: enumVariantNames.map((n) => n.toUpperCase()).toString(),
                    data: `${
                        variantsWithFields.length > 0
                            ? variantsWithFields.concat([typeNameForDataFieldInfoType]).join(' | ')
                            : typeNameForDataFieldInfoType
                    }`,
                },
            ]);
        }
    }
    return typeArr;
}

//#endregion
