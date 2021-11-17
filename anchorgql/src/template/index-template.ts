import { ApolloServer } from "apollo-server-express";
import express from "express";
import anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import http from "http";
import { readFileSync } from "fs";
import configVars from "./config.json";

const provider = anchor.Provider.env();
anchor.setProvider(provider);

const idl = JSON.parse(readFileSync(configVars["IDL_PATH"], "utf8"));
const programId = new anchor.web3.PublicKey(configVars["PROGRAM_ID"]);
const client = new anchor.Program(idl, programId);
const LOG_START_INDEX = "Program log: ".length;
const eventParser = true;
let globalEvents = [];

function pubKeyBigNumTransform(o) {
  Object.keys(o).forEach(function (k) {
    if (o[k] instanceof PublicKey) {
      o[k] = o[k].toBase58();
    }
    if (o[k] instanceof BN) {
      o[k] = parseInt(o[k]);
    }
    if (o[k] !== null && typeof o[k] === "object") {
      pubKeyBigNumTransform(o[k]);
    }
  });
  return o;
}

async function getAccountData(account: string, id = null) {
  if (id !== null) {
    let value = await client.account[account].fetch(id);
    let transformed = pubKeyBigNumTransform(value);
    return [
      {
        publicKey: id,
        account: transformed,
      },
    ];
  } else {
    let value = await client.account[account].all();
    let transformed = pubKeyBigNumTransform(value);
    return transformed;
  }
}

async function parseEvents() {
  console.log("Parsing events");
  provider.connection.onLogs(programId, (x) => {
    let allLogs = x.logs;
    allLogs.forEach((l) => {
      if (l.startsWith("Program log:")) {
        const logStr = l.slice(LOG_START_INDEX);
        try {
          const event = client.coder.events.decode(logStr);
          if (event !== null) {
            let eventValues = pubKeyBigNumTransform(event);
            eventValues["ts"] = Date.now();
            globalEvents.push = function (elem) {
              if (this.length == 1000) {
                this.pop();
              }
              return [].unshift.call(this, elem);
            };
            globalEvents.push(eventValues);
            // console.log("Event Count: "+globalEvents.length)
          }
        } catch (error) {
          console.log(error);
        }
      }
    });
  });
}

/*
  Don't Move around this code. The code to create resolvers makes assumptions on this code 
  located here
 */
import { typeDefs } from "./root.js";

const resolvers = {
  Query: {
    __PROJECTNAME__: () => ({}),
  },
  __ROOTNAME__: {
    ///----------ACCOUNT_RESOLVERS----------///
    __ACCOUNTNAME__: async (_, data) => {
      return await getAccountData("__ANCHORACCOUNTNAME__", data["id"]);
    },
    ///----------ACCOUNT_RESOLVERS----------///

    ///----------EVENT_RESOLVER----------///
    events: async () => {
      return globalEvents.sort((a, b) => b.ts - a.ts);
    },
    ///----------EVENT_RESOLVER----------///

    config: async () => {
      return {
        provider: configVars.anchorProviderURL,
        programId: configVars.programID,
      };
    },
  },
};

async function startApolloServer() {
  eventParser ? parseEvents() : null;

  const configurations = {
    // Note: You may need sudo to run on port 443
    production: { port: configVars.port, hostname: "localhost" },
    development: { port: 4000, hostname: "localhost" },
  };

  const environment = process.env.NODE_ENV || "production";
  const config = configurations[environment];

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();
  server.applyMiddleware({ app });

  // Create the HTTPS or HTTP server, per configuration
  let httpServer = http.createServer(app);

  await new Promise(() => httpServer.listen());
  console.log(
    "🚀 Server ready at",
    `http://${config.hostname}:${config.port}${server.graphqlPath}`
  );
  return { server, app };
}

startApolloServer();
