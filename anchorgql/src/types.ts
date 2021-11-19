export type OperationName = string & {};

export type OpertationReturnType = string & {};

export type OperationType = string & {};

export type Operations = [type: OperationType, options: Record<OperationName, OpertationReturnType>][];

//#region IDL Types

export type Idl = {
    version: string;
    name: string;
    instructions: IdlInstruction[];
    state?: IdlState;
    accounts?: IdlTypeDef[];
    types?: IdlTypeDef[];
    events?: IdlEvent[];
    errors?: IdlErrorCode[];
};

export type IdlEvent = {
    name: string;
    fields: IdlEventField[];
};

export type IdlEventField = {
    name: string;
    type: IdlType;
    index: boolean;
};

export type IdlInstruction = {
    name: string;
    accounts: IdlAccountItem[];
    args: IdlField[];
};

export type IdlState = {
    struct: IdlTypeDef;
    methods: IdlStateMethod[];
};

export type IdlStateMethod = IdlInstruction;

export type IdlAccountItem = IdlAccount | IdlAccounts;

export type IdlAccount = {
    name: string;
    isMut: boolean;
    isSigner: boolean;
};

// A nested/recursive version of IdlAccount.
export type IdlAccounts = {
    name: string;
    accounts: IdlAccountItem[];
};

export type IdlField = {
    name: string;
    type: IdlType;
};

export type IdlTypeDef = {
    name: string;
    type: IdlTypeDefTy;
};

type IdlTypeDefTy = {
    kind: 'struct' | 'enum';
    fields?: IdlTypeDefStruct;
    variants?: IdlEnumVariant[];
};

type IdlTypeDefStruct = Array<IdlField>;

export type IdlType =
    | 'bool'
    | 'u8'
    | 'i8'
    | 'u16'
    | 'i16'
    | 'u32'
    | 'i32'
    | 'u64'
    | 'i64'
    | 'u128'
    | 'i128'
    | 'bytes'
    | 'string'
    | 'publicKey'
    | IdlTypeVec
    | IdlTypeOption
    | IdlTypeDefined;

export type IdlTypeVec = {
    vec: IdlType;
};

export type IdlTypeOption = {
    option: IdlType;
};

// User defined type.
export type IdlTypeDefined = {
    defined: string;
};

export type IdlEnumVariant = {
    name: string;
    fields?: IdlEnumFields;
};

export type IdlEnumFields = IdlEnumFieldsNamed | IdlEnumFieldsTuple;

export type IdlEnumFieldsNamed = IdlField[];

export type IdlEnumFieldsTuple = IdlType[];

type IdlErrorCode = {
    code: number;
    name: string;
    msg?: string;
};

//#endregion
