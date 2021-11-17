import { gql } from "apollo-server-express";

export const typeDefs = gql`
    scalar JSON
///--------------------///

    type Config {
        provider: String
        programId: String
    }
`;
