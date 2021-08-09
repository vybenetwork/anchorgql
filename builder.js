const { promises: fs } = require("fs");

//** Edit this to change your server directory */
const subDir = "./server"

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
    return [["Query",{[name]:"Root"}]] 
}

async function getRootType(config){
    let accountNames = config['accounts'].map(x => {
       return {
            [x.name.charAt(0).toLowerCase() + x.name.slice(1)]:"["+x.name+"]"
       } 
    })
    accountNames.push({"config":"Config"})
    return [["Root",Object.assign({}, ...accountNames)]]

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
            typeArr.push(["enum",x['name'],x['type']["variants"].map(x=> [x.name.charAt(0).toLowerCase() + x.name.slice(1)])])
            let variants = x['type']['variants'].map(y => {
                if("fields" in y){
                    let name = y['name']
                    let values = y['fields'].map(z => {
                        return {
                            [z['name']]:"String"
                        }
                    })
                    typeArr.push([name,Object.assign({}, ...values)])
                }
            })
        }
    }
    return typeArr 
}

async function buildType(mapping){
    // console.log(mapping)
    let stringType = mapping.map(x =>{
        if(x[0]==="enum"){
            return `\nenum ${x[1]} {\n${"    "+x[2].join('\n    ')} \n}\n`.replace(/['",]+/g, '');
        } else{
            return `\ntype ${x[0]} ${JSON.stringify(x[1], null, 4)} \n`.replace(/['",]+/g, '');
        }
    })
    
    return stringType
}


async function buildTypeDef(typeDefTemplateFile,typeDefOutputFile,config,projectName){
    let query = await getQueryType(projectName)
    let root = await getRootType(config)
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
    }

async function copyFiles(){
    await fs.copyFile("./package.json", "./server/package.json")
    await fs.copyFile("./template/helpers.js", "./server/helpers.js")

   }


async function main(){
    const config = require('./config.json')

    const projectName = config["projectName"]
    const url = config["url"]
    const indexTemplateFile = config["indexTemplateFile"]
    const typeDefTemplateFile = config["typeDefTemplateFile"]
    const indexOutputFile = config["indexOutputFile"]
    const typeDefOutputFile = config["typeDefOutputFile"]
    const idlPath = config["idlPath"]

    const idlConfig = require(idlPath)
    await makeDirs()
    await copyFiles()
    await buildTypeDef(typeDefTemplateFile,typeDefOutputFile,idlConfig,projectName)
    await buildResolvers(indexTemplateFile,indexOutputFile,idlConfig,projectName,url)

}

main()