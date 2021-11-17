"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const express_1 = __importDefault(require("express"));
const anchor_1 = __importDefault(require("@project-serum/anchor"));
const web3_js_1 = require("@solana/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const config_json_1 = __importDefault(require("./config.json"));
const provider = anchor_1.default.Provider.env();
anchor_1.default.setProvider(provider);
const idl = JSON.parse((0, fs_1.readFileSync)(config_json_1.default["IDL_PATH"], "utf8"));
const programId = new anchor_1.default.web3.PublicKey(config_json_1.default["PROGRAM_ID"]);
const client = new anchor_1.default.Program(idl, programId);
const LOG_START_INDEX = "Program log: ".length;
const eventParser = true;
let globalEvents = [];
function pubKeyBigNumTransform(o) {
    Object.keys(o).forEach(function (k) {
        if (o[k] instanceof web3_js_1.PublicKey) {
            o[k] = o[k].toBase58();
        }
        if (o[k] instanceof bn_js_1.default) {
            o[k] = parseInt(o[k]);
        }
        if (o[k] !== null && typeof o[k] === "object") {
            pubKeyBigNumTransform(o[k]);
        }
    });
    return o;
}
async function getAccountData(account, id = null) {
    if (id !== null) {
        let value = await client.account[account].fetch(id);
        let transformed = pubKeyBigNumTransform(value);
        return [
            {
                publicKey: id,
                account: transformed,
            },
        ];
    }
    else {
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
                }
                catch (error) {
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
const root_js_1 = require("./root.js");
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
                provider: config_json_1.default.anchorProviderURL,
                programId: config_json_1.default.programID,
            };
        },
    },
};
async function startApolloServer() {
    eventParser ? parseEvents() : null;
    const configurations = {
        // Note: You may need sudo to run on port 443
        production: { port: config_json_1.default.port, hostname: "localhost" },
        development: { port: 4000, hostname: "localhost" },
    };
    const environment = process.env.NODE_ENV || "production";
    const config = configurations[environment];
    const server = new apollo_server_express_1.ApolloServer({ typeDefs: root_js_1.typeDefs, resolvers });
    await server.start();
    const app = (0, express_1.default)();
    server.applyMiddleware({ app });
    // Create the HTTPS or HTTP server, per configuration
    let httpServer = http_1.default.createServer(app);
    await new Promise(() => httpServer.listen());
    console.log("🚀 Server ready at", `http://${config.hostname}:${config.port}${server.graphqlPath}`);
    return { server, app };
}
startApolloServer();
//# sourceMappingURL=index-template.js.map