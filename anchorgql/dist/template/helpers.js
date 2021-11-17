"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_1 = require("apollo-server");
const node_fetch_1 = __importDefault(require("node-fetch"));
const getData = async (url) => {
    try {
        const res = await (0, node_fetch_1.default)(url);
        const json = await res.json();
        if (isHTTPError(res.status)) {
            throw new apollo_server_1.ApolloError(json, "http-status-error", {
                statusCode: res.status,
                error: json,
            });
        }
        console.log(json);
        return json;
    }
    catch (error) {
        console.log(JSON.stringify(error));
        throw error;
    }
};
const postData = async (url, body) => {
    try {
        const res = await (0, node_fetch_1.default)(url, {
            method: "post",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (isHTTPError(res.status)) {
            throw new apollo_server_1.ApolloError(json, "http-status-error", {
                statusCode: res.status,
                error: json,
            });
        }
        console.log(json);
        return json;
    }
    catch (error) {
        console.log(JSON.stringify(error));
        throw error;
    }
};
const isHTTPError = (status) => {
    return !(status >= 200 && status < 300);
};
exports.getData = getData;
exports.postData = postData;
//# sourceMappingURL=helpers.js.map