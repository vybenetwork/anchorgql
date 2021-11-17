const { promises: fs } = require("fs");
const _ = require("lodash");
const { eventNames } = require("process");
const config = require("./config");
const fse = require("fs-extra");

//** Edit this to change your server directory */
const subDir = "./src/channel_" + config["PROJECT_NAME"];
const serverCert = "./src/template/server.crt";
const serverKey = "./src/template/server.key";
// const serverCert = "./template/server_local.crt"
// const serverKey = "./template/server_local.key"

function convertPascal(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function getAccountTypes(idlConfig) {
  const projectName = config.projectName;
  try {
    if ("accounts" in idlConfig) {
      let mapping = idlConfig["accounts"].map((x) => {
        let name = convertPascal(projectName) + "_" + x["name"] + "Account";
        let fields = x["type"]["fields"].map((y) => {
          let key;
          if (typeof y["type"] === "string" || y["type"] instanceof String) {
            key = "String";
          } else if (y["type"] instanceof Object) {
            if (Object.keys(y["type"])[0] === "vec") {
              if (y["type"]["vec"]["defined"]) {
                key =
                  "[" +
                  convertPascal(projectName) +
                  "_" +
                  y["type"]["vec"]["defined"] +
                  "]";
              } else {
                key = "[String]";
              }
            } else if (Object.keys(y["type"])[0] === "array") {
              key = "[String]";
            } else if (Object.keys(y["type"])[0] === "defined") {
              key = convertPascal(projectName) + "_" + y["type"]["defined"];
            }
          }
          return {
            [y["name"]]: key,
          };
        });
        return [name, Object.assign({}, ...fields)];
      });
      return mapping;
    } else {
      return [];
    }
  } catch (error) {
    console.log(error);
  }
}

async function getAccountRootTypes(idlConfig) {
  let projectName = config.projectName;
  if ("accounts" in idlConfig) {
    let mapping = config["accounts"].map((x) => {
      let name = convertPascal(projectName) + "_" + x["name"];
      let fields = {
        publicKey: "String",
        account: convertPascal(projectName) + "_" + x["name"] + "Account",
      };
      return [name, fields];
    });
    return mapping;
  } else {
    return [];
  }
}

async function getQueryType() {
  const projectName = config.projectName;
  let subgraph = "channel_" + projectName;
  return [["Query", { [subgraph]: convertPascal(projectName) }]];
}

async function getRootType(idlConfig) {
  let projectName = config.projectName;
  let accountNames = [];

  if ("accounts" in idlConfig) {
    accountNames = idlConfig["accounts"].map((x) => {
      return {
        [projectName + "_" + x["name"] + " (id: String)"]:
          "[" + convertPascal(projectName) + "_" + x.name + "]",
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
  } else {
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

async function getTypes(idlConfig) {
  let projectName = config.projectName;
  let typeArr = [];
  if (idlConfig.hasOwnProperty("types")) {
    for (let x of idlConfig["types"]) {
      let name = convertPascal(projectName) + "_" + x["name"];
      let values;
      if (x["type"]["kind"] === "struct") {
        values = x["type"]["fields"].map((y) => {
          let key;
          if (typeof y["type"] === "string" || y["type"] instanceof String) {
            key = "String";
          } else if (y["type"] instanceof Object) {
            if (Object.keys(y["type"])[0] === "vec") {
              if (y["type"]["vec"]["defined"]) {
                key =
                  "[" +
                  convertPascal(projectName) +
                  "_" +
                  y["type"]["vec"]["defined"] +
                  "]";
              } else {
                key = "[String]";
              }
            } else if (Object.keys(y["type"])[0] === "array") {
              key = "[String]";
            } else if (Object.keys(y["type"])[0] === "defined") {
              key = convertPascal(projectName) + "_" + y["type"]["defined"];
            } else {
              key = "[String]";
            }
          } else {
            key = "[String]";
          }
          return {
            [y["name"]]: key,
          };
        });
        if (values.length !== 0) {
          typeArr.push([name, Object.assign({}, ...values)]);
        }
      } else if (x["type"]["kind"] === "enum") {
        // fix this, not using variants
        let mainTypeFields = x["type"]["variants"].map((x) => {
          return {
            [_.camelCase(x["name"])]:
              "[" + convertPascal(projectName) + "_" + x.name + "]",
          };
        });
        typeArr.push([
          convertPascal(projectName) + "_" + x["name"],
          Object.assign({}, ...mainTypeFields),
        ]);
        //typeNames = idlConfig["types"].map((x) => x["name"]);
        for (let y of x["type"]["variants"]) {
          if ("fields" in y) {
            let name = y["name"];
            let values = y["fields"].map((z) => {
              return {
                [_.camelCase(z["name"])]: "String",
              };
            });
            values.push({ ts: "String" });
            typeArr.push([
              convertPascal(projectName) + "_" + name,
              Object.assign({}, ...values),
            ]);
          } else {
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
      return `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(
        /['",]+/g,
        ""
      );
    });

    return stringType.join("");
  } else {
    return "";
  }
}

async function buildTypeDef(
  typeDefTemplateFile,
  typeDefOutputFile,
  idlConfig,
  projectName
) {
  let query = await getQueryType(projectName);
  let root = await getRootType(idlConfig);
  let accountRoot = await getAccountRootTypes(idlConfig);
  let account = await getAccountTypes(idlConfig);
  let types = await getTypes(idlConfig);

  let queryStr = await buildType(query);

  let rootStr = await buildType(root);
  let accountRootStr = await buildType(accountRoot);
  let accountStr = await buildType(account);
  let typesStr = await buildType(types);

  let typeDefs = queryStr + rootStr + accountRootStr + accountStr + typesStr;
  let data = await fs.readFile(typeDefTemplateFile, "utf8");
  const split = data.split("///--------------------///");
  let codeString = split[0];
  codeString = codeString.concat(typeDefs);
  codeString = codeString.concat(split[1]);

  await fs.writeFile(typeDefOutputFile, codeString);
}

async function buildResolvers(
  indexTemplateFile,
  indexOutputFile,
  config,
  projectName,
  url,
  eventVars
) {
  // ACCOUNT SETUP
  let data = await fs.readFile(indexTemplateFile, "utf8");
  var split = data.split("///----------ACCOUNT_RESOLVERS----------///");
  let codeString = split[0]
    .replace(/__URL__/g, url)
    .replace(/__PROJECTNAME__/g, "channel_" + projectName)
    .replace(
      /__ROOTNAME__/g,
      projectName.charAt(0).toUpperCase() + projectName.slice(1)
    );
  if ("accounts" in config) {
    let accountNames = config["accounts"].map((x) => x["name"]);
    for (let x of accountNames) {
      acc = projectName + "_" + x;
      var result = split[1].replace(
        /__ANCHORACCOUNTNAME__/g,
        x.charAt(0).toLowerCase() + x.slice(1)
      );
      var result = result.replace(/__ACCOUNTNAME__/g, acc);
      codeString = codeString.concat(result);
    }
    codeString = codeString.concat(split[2]);
  } else {
    codeString = codeString.concat(split[2]);
  }

  split = codeString.split("///----------EVENT_RESOLVER----------///");
  if ("events" in config) {
    codeString = split[0].concat(split[1]).concat(split[2]);
  } else {
    codeString = split[0].concat(split[2]);
    codeString = codeString.replace(
      /const eventParser = true/g,
      "const eventParser = false"
    );
  }

  await fs.writeFile(indexOutputFile, codeString);
}

async function makeDirs() {
  await fs.mkdir(subDir, { recursive: true });
  await fs.mkdir(subDir + "/src/idls", { recursive: true });
  //await fs.mkdir(subDir + "/node_modules", { recursive: true });
}

async function copyFiles(config) {
  await fs.copyFile(
    "./src/template/package-template.json",
    subDir + "/package.json"
  );
  let data = await fs.readFile(subDir + `/package.json`, "utf8");
  var result = data.replace(
    /__YOURANCHORPROVIDERURL__/g,
    config["ANCHOR_PROVIDER_URL"]
  );
  await fs.writeFile(subDir + `/package.json`, result);
  await fs.copyFile(
    config["IDL_PATH"],
    subDir + config["IDL_PATH"].substring(1)
  );

  await fs.copyFile("./src/config.json", subDir + "/src/config.json");
  await fs.copyFile(serverCert, subDir + "/server.crt");
  await fs.copyFile(serverKey, subDir + "/server.key");
  // await fse.copy("./template/node_modules_template",subDir+"/node_modules")
}

async function main() {
  const projectName = config.projectName;
  const url = config.anchorProviderUrl;
  const idlPath = config.idlPath;

  const indexTemplateFile = "./src/template/index-template.js";
  const typeDefTemplateFile = "./src/template/typedef-template.js";
  const indexOutputFile = subDir + "/src/index.js";
  const typeDefOutputFile = subDir + "/src/root.js";

  const idlConfig = require("./idls/jet.json");
  await makeDirs();
  await copyFiles(config);
  await buildTypeDef(
    typeDefTemplateFile,
    typeDefOutputFile,
    idlConfig,
    projectName
  );
  await buildResolvers(
    indexTemplateFile,
    indexOutputFile,
    idlConfig,
    projectName,
    url
  );
}

main();
