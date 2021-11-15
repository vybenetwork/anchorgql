const { ApolloServer } = require('apollo-server-express');
const express = require("express")
const anchor = require("@project-serum/anchor");
const provider = anchor.Provider.env();
const { PublicKey } = require('@solana/web3.js')
const BN = require("bn.js")
anchor.setProvider(provider);

const fs =require('fs');
const https =require('https');
const http =require( 'http');

const configVars = require("./config")
let idl = JSON.parse(require('fs').readFileSync(configVars["IDL_PATH"]), 'utf8');
let programId = new anchor.web3.PublicKey(configVars["PROGRAM_ID"]);
let client = new anchor.Program(idl, programId);
const LOG_START_INDEX = "Program log: ".length;
const eventParser = true
var globalEvents = []
var subscriptionId = null

function pubKeyBigNumTransform(o) {
    Object.keys(o).forEach(function (k) {
        if (o[k] instanceof PublicKey) {
            o[k] = o[k].toBase58();
        }
        if (o[k] instanceof BN) {
            o[k] = parseInt(o[k]);
        }
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
        // console.log(x)
        // console.log("Event logged")
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
                        // console.log("Event Count: "+globalEvents.length)
                    }              
                } catch (error) {
                    console.log(error)
                }
              }
        })
    })
}



const {typeDefs} = require('./root.js');
const { strict } = require('assert');


const resolvers = {
    Query:{
        __PROJECTNAME__:()=>({})
    },
    __ROOTNAME__: {

        ///----------ACCOUNT_RESOLVERS----------///
        __ACCOUNTNAME__:   async (_,data) => {
                return (await getAccountData("__ANCHORACCOUNTNAME__",data['id']))
            },        
        ///----------ACCOUNT_RESOLVERS----------///
        
        ///----------EVENT_RESOLVER----------///
        events: async (_) => {
            return globalEvents.sort((a,b) => b.ts - a.ts);
        }, 
        ///----------EVENT_RESOLVER----------///

        config: async () => {
            return {
                    provider:configVars["ANCHOR_PROVIDER_URL"],
                    programId:configVars["PROGRAM_ID"]
                }
            }
        }
};

async function startApolloServer() {
    eventParser?parseEvents(): null

    const configurations = {
      // Note: You may need sudo to run on port 443
      production: { ssl: true, port: configVars['PORT'], hostname: 'localhost' },
      development: { ssl: false, port: 4000, hostname: 'localhost' },
    };
  
    const environment = process.env.NODE_ENV || 'production';
    const config = configurations[environment];
  
    const server = new ApolloServer({ typeDefs, resolvers });
    await server.start();
  
    const app = express();
    server.applyMiddleware({ app });
  
    // Create the HTTPS or HTTP server, per configuration
    let httpServer;
    if (config.ssl) {
      // Assumes certificates are in a .ssl folder off of the package root.
      // Make sure these files are secured.
      httpServer = https.createServer(
        {
          key: fs.readFileSync(`./server.key`),
          cert: fs.readFileSync(`./server.crt`)
        },
        app,
      );
    } else {
      httpServer = http.createServer(app);
    }
  
    await new Promise(resolve => httpServer.listen({ port: config.port }, resolve));
    console.log(
      '🚀 Server ready at',
      `http${config.ssl ? 's' : ''}://${config.hostname}:${config.port}${server.graphqlPath}`
    );
    return { server, app };
  }
  
startApolloServer()

