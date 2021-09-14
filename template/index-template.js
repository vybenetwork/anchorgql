const { ApolloServer } = require('apollo-server');
const anchor = require("@project-serum/anchor");
const provider = anchor.Provider.env();
const { PublicKey } = require('@solana/web3.js')
const BN = require("bn.js")
anchor.setProvider(provider);

const config = require("../config")
let idl = JSON.parse(require('fs').readFileSync(config["IDL_PATH"]), 'utf8');
let programId = new anchor.web3.PublicKey(config["PROGRAM_ID"]);
let client = new anchor.Program(idl, programId);
const LOG_START_INDEX = "Program log: ".length;

var globalEvents = []

function pubKeyBigNumTransform(o) {
    Object.keys(o).forEach(function (k) {
        if (o[k] instanceof PublicKey) {
            o[k] = o[k].toBase58();
        }
        // if (o[k] instanceof BN) {
        //     o[k] = parseInt(o[k]);
        // }
        if (o[k] !== null && typeof o[k] === 'object') {
            pubKeyBigNumTransform(o[k]);
        }
    });
    return o
}

async function getAccountData(account, id=null){
    if(id !== null){

        let value = await client.account[account].fetch(id)
        let transformed = pubKeyBigNumTransform(value)
        return [
                {
                    publicKey:id,
                    account:transformed
                }
            ]

    } else {
        let value = await client.account[account].all()
        let transformed = pubKeyBigNumTransform(value)
        return transformed

    }
}

async function parseEvents(){
    console.log("Parsing events")
    provider.connection.onLogs(programId,x => {
        console.log("Event logged")
        let allLogs = x.logs
        allLogs.forEach(l => {
            if(l.startsWith("Program log:")) {
                const logStr = l.slice(LOG_START_INDEX);
                try {
                    const event = client.coder.events.decode(logStr); 
                    if(event !== null){
                        let eventValues = pubKeyBigNumTransform(event)
                        eventValues["ts"] = Date.now()
                        globalEvents.push = function(elem){
                            if(this.length==1000){
                              this.pop();
                            }
                            return [].unshift.call(this, elem);
                          }
                        globalEvents.push(eventValues)
                        console.log("Event Count: "+globalEvents.length)
                    }              
                } catch (error) {
                    console.log(error)
                }
              }
        })
    })
}



const {typeDefs} = require('./root.js')


const resolvers = {
    Query:{
        __PROJECTNAME__:()=>({})
    },
    __ROOTNAME__: {

        ///----------ACCOUNT_RESOLVERS----------///
        __ACCOUNTNAME__:   async (_,data) => {
                return (await getAccountData("__ACCOUNTNAME__",data['id']))
            },        
        ///----------ACCOUNT_RESOLVERS----------///

        events: async (_) => {
            return globalEvents.sort((a,b) => b.ts - a.ts);
        }, 

        config: async () => {
            let config = JSON.parse(require('fs').readFileSync("../config.json", 'utf8'));
            return {
                    anchorVersion:config["ANCHOR_VERSION"],
                    provider:config["ANCHOR_PROVIDER_URL"],
                    programId:config["PROGRAM_ID"]
                }
            }
        }
};

const schema = new ApolloServer({ typeDefs, resolvers });

schema.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
    console.log(`schema ready at ${url}`);
    parseEvents()

});
