"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
const apollo_server_express_1 = require("apollo-server-express");
exports.typeDefs = (0, apollo_server_express_1.gql) `
    scalar JSON
///--------------------///

    type Config {
        provider: String
        programId: String
    }
`;
//# sourceMappingURL=typedef-template.js.map