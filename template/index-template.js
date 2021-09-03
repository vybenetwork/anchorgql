const { ApolloServer } = require('apollo-server');
const {getData, postData} = require('./helpers');
const anchor = require("@project-serum/anchor");
const provider = anchor.Provider.env();
const { PublicKey } = require('@solana/web3.js')
const BN = require("bn.js")
anchor.setProvider(provider);

const config = require("../config")
let idl = JSON.parse(require('fs').readFileSync(config["IDL_PATH"]), 'utf8');
let programId = new anchor.web3.PublicKey(config["PROGRAM_ID"]);
let client = new anchor.Program(idl, programId);

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


const {typeDefs} = require('./root.js')
// replace with actual REST endpoint
const restAPIEndpoint = '__URL__';

const resolvers = {
    Query:{
        __PROJECTNAME__:()=>({})
    },
    __ROOTNAME__: {

        ///--------------------///


        __ACCOUNTNAME__:   async (_,data) => {
                return (await getAccountData("__ACCOUNTNAME__",data['id']))
            },

        
        ///--------------------///


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
});