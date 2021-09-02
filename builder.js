const { promises: fs } = require("fs");
const _ = require("lodash")
//** Edit this to change your server directory */
const subDir = "./server"



function convertPascal(value){
    return value.charAt(0).toUpperCase() + value.slice(1)
}


async function getAccountTypes(config){
    let mapping = config['accounts'].map(x => {
        let name = x['name']+"Account"
        let fields = x['type']['fields'].map(y => {
            return {
                [y['name']]:!(y['type'] instanceof Object) ? 
                    "String":
                    y['type']['defined'] ?
                    y['type']['defined'] :"["+y['type']['vec']['defined']+"]"     
            }
        })
        return [name,Object.assign({}, ...fields)]
    })
    return mapping 
}

async function getAccountRootTypes(config){
    let mapping = config['accounts'].map(x => {
        let name = x['name']
        let fields = {
            "publicKey": "String",
            "account": x['name']+"Account"
        }
        return [name,fields]
        })
    return mapping 
}

async function getQueryType(name){
    return [["Query",{[name]:convertPascal(name)}]] 
}

async function getRootType(config,name){
    let accountNames = config['accounts'].map(x => {
       return {
            [_.camelCase(x["name"])+" (id: String)"]:"["+x.name+"]"
       } 
    })
    accountNames.push({"config":"Config"})
    return [[name.charAt(0).toUpperCase() + name.slice(1),Object.assign({}, ...accountNames)]]

}

async function getTypes(config){
    let typeArr = []
    for(let x of config['types']){
        let name = x['name']
        let values
        if(x['type']['kind'] === 'struct'){
            values = x['type']['fields'].map(y => {
                return {
                    [y['name']]:"String"
                }
            })
            typeArr.push([name,Object.assign({}, ...values)])

        } else if(x['type']['kind'] === 'enum'){
            // fix this, not using variants
            let mainTypeFields = x['type']["variants"].map(x=> {
                return {
                    [_.camelCase(x['name'])]:x.name
                }
            })
            typeArr.push([x["name"],Object.assign({}, ...mainTypeFields)])

            for(let y of x['type']['variants']){
                if("fields" in y){
                    let name = y['name']
                    let values = y['fields'].map(z => {
                        return {
                            [_.camelCase(z['name'])]:"String"
                        }
                    })
                    typeArr.push([name,Object.assign({}, ...values)])
                }
                else{
                    typeArr.push([y["name"],{"_":"Boolean"}])
                }
            }
        }
    }
    return typeArr 
}

async function buildType(mapping){
    let stringType = mapping.map(x =>{
        return `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, '');
    })
    
    return stringType
}


async function buildTypeDef(typeDefTemplateFile,typeDefOutputFile,config,projectName){
    let query = await getQueryType(projectName)
    let root = await getRootType(config,projectName)
    let accountRoot = await getAccountRootTypes(config)
    let account = await getAccountTypes(config)
    let types = await getTypes(config)

    let queryStr = await buildType(query)
    let rootStr = await buildType(root)
    let accountRootStr = await buildType(accountRoot)
    let accountStr = await buildType(account)
    let typesStr = await buildType(types)

    let typeDefs = queryStr.join('')+rootStr.join('')+accountRootStr.join('')+accountStr.join('')+typesStr.join('')
    let data = await fs.readFile(typeDefTemplateFile, 'utf8')
    const split = data.split('///--------------------///')
    let codeString = split[0]
    codeString = codeString.concat(typeDefs)
    codeString= codeString.concat(split[1])
    
    await fs.writeFile(typeDefOutputFile, codeString) 
}

async function buildResolvers(indexTemplateFile,indexOutputFile,config,projectName,url){
    let data = await fs.readFile(indexTemplateFile, 'utf8')
    const split = data.split('///--------------------///')
    let codeString = split[0]
    .replace(/__URL__/g, url)
    .replace(/__PROJECTNAME__/g, projectName)
    .replace(/__ROOTNAME__/g, projectName.charAt(0).toUpperCase() + projectName.slice(1))
    let accountNames = config['accounts'].map(x => x['name'])
    for(let x of accountNames){
        var result = split[1].replace(/__ACCOUNTNAME__/g, x.charAt(0).toLowerCase() + x.slice(1));
        codeString = codeString.concat(result)
    }
    codeString= codeString.concat(split[2])
    await fs.writeFile(indexOutputFile, codeString)

}

async function makeDirs(){
    await fs.mkdir(subDir, {recursive:true})    
    await fs.mkdir(subDir+"/idls", {recursive:true})   
    }

async function copyFiles(config){
    await fs.copyFile("./template/package-template.json", "./server/package.json")
    let data = await fs.readFile(subDir+`/package.json`, 'utf8')
    var result = data.replace(/__YOURANCHORPROVIDERURL__/g,config['ANCHOR_PROVIDER_URL']);
    console.log(result)
    await fs.writeFile(subDir+`/package.json`, result)
    await fs.copyFile("./template/helpers.js", "./server/helpers.js")
    console.log(config)
    await fs.copyFile(config['IDL_PATH'], "./server"+(config['IDL_PATH'].substring(1)))

   }


async function main(){
    const config = require('./config.json')
    const projectName = config["PROJECT_NAME"]
    const url = config["URL"]
    const idlPath = config["IDL_PATH"]

    const indexTemplateFile = "./template/index-template.js"
    const typeDefTemplateFile = "./template/typedef-template.js"
    const indexOutputFile = "./server/index.js"
    const typeDefOutputFile = "./server/root.js"

    const idlConfig = require(idlPath)
    await makeDirs()
    await copyFiles(config)
    await buildTypeDef(typeDefTemplateFile,typeDefOutputFile,idlConfig,projectName)
    await buildResolvers(indexTemplateFile,indexOutputFile,idlConfig,projectName,url)

}

main()