"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const config = __importStar(require("./config.json"));
const promises_1 = require("fs/promises");
const lodash_1 = require("lodash");
//** Edit this to change your server directory */
const subDir = "./src/channel_" + config.projectName;
// const serverCert = "./template/server_local.crt"
// const serverKey = "./template/server_local.key"
function convertPascal(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
function getKeyForIdlObjectType(idlObjectType) {
    let projectName = config.projectName;
    let key;
    if ("vec" in idlObjectType) {
        let castedVecType = idlObjectType.vec;
        if (castedVecType instanceof Object && "defined" in castedVecType) {
            let castedDefinedVecType = castedVecType.defined;
            key = "[" + convertPascal(projectName) + "_" + castedDefinedVecType + "]";
        }
        else {
            key = "[String]";
        }
    }
    else if ("option" in idlObjectType) {
        // TODO: check this with arun
        let castedOptionType = idlObjectType.option;
        if (castedOptionType instanceof Object && "defined" in castedOptionType) {
            let castedDefinedOptionType = castedOptionType.defined;
            key =
                "[" + convertPascal(projectName) + "_" + castedDefinedOptionType + "]";
        }
        else {
            key = "[String]";
        }
    }
    else if ("defined" in idlObjectType) {
        key = convertPascal(projectName) + "_" + idlObjectType.defined;
    }
    else {
        key = "[String]";
    }
    return key;
}
function getGqlTypeForIdlScalarType(idlType) {
    const stringTypes = [
        "u64",
        "i64",
        "u128",
        "i128",
        "bytes",
        "string",
        "publicKey",
    ];
    const intTypes = ["u8", "i8", "u16", "i16", "u32", "i32"];
    const idlTypeStringified = idlType;
    if (stringTypes.includes(idlTypeStringified)) {
        return "String";
    }
    else if (intTypes.includes(idlTypeStringified)) {
        return "Int";
    }
    else {
        throw `Unable to map ${idlType.toString} IDL type to it's corresponding GQL Type`;
    }
}
async function getAccountTypes() {
    const projectName = config.projectName;
    try {
        if ("accounts" in idlConfig) {
            let mapping = idlConfig.accounts.map((x) => {
                let name = convertPascal(projectName) + "_" + x.name + "Account";
                let fields = x.type.fields.map((y) => {
                    let key;
                    // if (typeof y.type === "string" || y.type instanceof String) {
                    //   key = "String";
                    // } else
                    if (y.type instanceof Object) {
                        key = getKeyForIdlObjectType(y.type);
                    }
                    else {
                        //TODO: add checks for other types here
                        key = getGqlTypeForIdlScalarType(y.type);
                    }
                    return {
                        [y["name"]]: key,
                    };
                });
                return [name, Object.assign({}, ...fields)];
            });
            return mapping;
        }
        else {
            return [];
        }
    }
    catch (error) {
        console.log(error);
    }
}
async function getAccountRootTypes() {
    let projectName = config.projectName;
    if ("accounts" in idlConfig) {
        let mapping = idlConfig.accounts.map((x) => {
            let name = convertPascal(projectName) + "_" + x.name;
            let fields = {
                publicKey: "String",
                account: convertPascal(projectName) + "_" + x.name + "Account",
            };
            return [name, fields];
        });
        return mapping;
    }
    else {
        return [];
    }
}
async function getQueryType() {
    const projectName = config.projectName;
    let subgraph = "channel_" + projectName;
    return [["Query", { [subgraph]: convertPascal(projectName) }]];
}
async function getRootType() {
    let projectName = config.projectName;
    let accountNames = [];
    if ("accounts" in idlConfig) {
        accountNames = idlConfig.accounts.map((x) => {
            return {
                [projectName + "_" + x.name + " (id: String)"]: "[" + convertPascal(projectName) + "_" + x.name + "]",
            };
        });
        accountNames.push({ config: "Config" });
        "events" in idlConfig ? accountNames.push({ events: "JSON" }) : null;
        return [
            [
                projectName.charAt(0).toUpperCase() + projectName.slice(1),
                Object.assign({}, ...accountNames),
            ],
        ];
    }
    else {
        accountNames.push({ config: "Config" });
        "events" in idlConfig ? accountNames.push({ events: "JSON" }) : null;
        return [
            [
                projectName.charAt(0).toUpperCase() + projectName.slice(1),
                Object.assign({}, ...accountNames),
            ],
        ];
    }
}
async function getTypes() {
    let projectName = config.projectName;
    let typeArr = [];
    if (idlConfig.hasOwnProperty("types")) {
        let idlTypes = idlConfig.types;
        for (let x of idlTypes) {
            let name = convertPascal(projectName) + "_" + x.name;
            let values = [];
            if (x.type.kind === "struct") {
                values = x.type.fields.map((y) => {
                    let key;
                    // if (y.type === "string") {
                    //   key = "String";
                    // } else
                    if (y.type instanceof Object) {
                        key = getKeyForIdlObjectType(y.type);
                    }
                    else {
                        //TODO: add checks for other types here
                        key = getGqlTypeForIdlScalarType(y.type);
                        //key = "[String]";
                    }
                    return {
                        [y["name"]]: key,
                    };
                });
                if (values.length > 0) {
                    typeArr.push([name, Object.assign({}, ...values)]);
                }
            }
            else if (x.type.kind === "enum") {
                let mainTypeFields = x.type.variants.map((x) => {
                    return {
                        [(0, lodash_1.camelCase)(x.name)]: "[" + convertPascal(projectName) + "_" + x.name + "]",
                    };
                });
                typeArr.push([
                    convertPascal(projectName) + "_" + x.name,
                    Object.assign({}, ...mainTypeFields),
                ]);
                //typeNames = idlConfig["types"].map((x) => x["name"]);
                for (let y of x.type.variants) {
                    if ("fields" in y) {
                        let name = y.name;
                        let values = y.fields.map((z) => {
                            //TODO: maybe a check needed here
                            if (z instanceof Object) {
                                const castedIdlField = z;
                                if (castedIdlField.type instanceof Object) {
                                    return {
                                        [(0, lodash_1.camelCase)(castedIdlField.name)]: getKeyForIdlObjectType(castedIdlField.type),
                                    };
                                }
                                else {
                                    return {
                                        [(0, lodash_1.camelCase)(castedIdlField.name)]: getGqlTypeForIdlScalarType(castedIdlField.type),
                                    };
                                    // return {
                                    //   // add logic to apply the gql type here
                                    //   [camelCase(z["name"])]: castedIdlField.type,
                                    // };
                                }
                            }
                            else {
                                return {
                                    [(0, lodash_1.camelCase)(z)]: "[String]",
                                };
                            }
                        });
                        values.push({ ts: "String" });
                        typeArr.push([
                            convertPascal(projectName) + "_" + name,
                            Object.assign({}, ...values),
                        ]);
                    }
                    else {
                        typeArr.push([
                            convertPascal(projectName) + "_" + y["name"],
                            { _: "Boolean" },
                        ]);
                    }
                }
            }
        }
    }
    return typeArr;
}
async function buildType(mapping) {
    if (mapping.length !== 0) {
        let stringType = mapping.map((x) => {
            return `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, "");
        });
        return stringType.join("");
    }
    else {
        return "";
    }
}
async function buildTypeDef(typeDefTemplateFile, typeDefOutputFile) {
    let query = await getQueryType();
    let root = await getRootType();
    let accountRoot = await getAccountRootTypes();
    let account = await getAccountTypes();
    let types = await getTypes();
    let queryStr = await buildType(query);
    let rootStr = await buildType(root);
    let accountRootStr = await buildType(accountRoot);
    let accountStr = await buildType(account);
    let typesStr = await buildType(types);
    let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr;
    let data = await (0, promises_1.readFile)(typeDefTemplateFile, "utf8");
    const split = data.split("///--------------------///");
    let codeString = split[0];
    codeString = codeString.concat(typeDefs);
    codeString = codeString.concat(split[1]);
    await (0, promises_1.writeFile)(typeDefOutputFile, codeString);
}
async function buildResolvers(indexTemplateFile, indexOutputFile) {
    let projectName = config.projectName;
    let url = config.anchorProviderURL;
    // ACCOUNT SETUP
    let data = await (0, promises_1.readFile)(indexTemplateFile, "utf8");
    var split = data.split("///----------ACCOUNT_RESOLVERS----------///");
    let codeString = split[0]
        .replace(/__URL__/g, url)
        .replace(/__PROJECTNAME__/g, "channel_" + projectName)
        .replace(/__ROOTNAME__/g, projectName.charAt(0).toUpperCase() + projectName.slice(1));
    if ("accounts" in idlConfig) {
        let accountNames = idlConfig["accounts"].map((x) => x["name"]);
        for (let x of accountNames) {
            let acc = projectName + "_" + x;
            var result = split[1].replace(/__ANCHORACCOUNTNAME__/g, x.charAt(0).toLowerCase() + x.slice(1));
            var result = result.replace(/__ACCOUNTNAME__/g, acc);
            codeString = codeString.concat(result);
        }
        codeString = codeString.concat(split[2]);
    }
    else {
        codeString = codeString.concat(split[2]);
    }
    split = codeString.split("///----------EVENT_RESOLVER----------///");
    if ("events" in idlConfig) {
        codeString = split[0].concat(split[1]).concat(split[2]);
    }
    else {
        codeString = split[0].concat(split[2]);
        codeString = codeString.replace(/const eventParser = true/g, "const eventParser = false");
    }
    await (0, promises_1.writeFile)(indexOutputFile, codeString);
}
async function makeDirs() {
    await (0, promises_1.mkdir)(subDir, { recursive: true });
    await (0, promises_1.mkdir)(subDir + "/src/idls", { recursive: true });
}
async function copyFiles() {
    await (0, promises_1.copyFile)("./src/template/package-template.json", subDir + "/package.json");
    let data = await (0, promises_1.readFile)(subDir + `/package.json`, "utf8");
    var result = data.replace(/__YOURANCHORPROVIDERURL__/g, config.anchorProviderURL);
    await (0, promises_1.writeFile)(subDir + `/package.json`, result);
    await (0, promises_1.copyFile)(config.idlPath, subDir + config.idlPath.substring(1));
    await (0, promises_1.copyFile)("./src/template/tsconfig-template.json", subDir + "/tsconfig.json");
    await (0, promises_1.copyFile)("./src/config.json", subDir + "/src/config.json");
    //await copyFile(config.serverCert, subDir + "/server.crt");
    //await copyFile(config.serverCertKey, subDir + "/server.key");
}
async function main() {
    idlConfig = await Promise.resolve().then(() => __importStar(require("../" + config.idlPath)));
    const indexOutputFile = subDir + "/src/index.ts";
    const typeDefOutputFile = subDir + "/src/root.ts";
    await makeDirs();
    await copyFiles();
    await buildTypeDef(config.typeDefTemplateFile, typeDefOutputFile);
    await buildResolvers(config.indexTemplateFile, indexOutputFile);
}
let idlConfig = null;
main();
//# sourceMappingURL=builder.js.map