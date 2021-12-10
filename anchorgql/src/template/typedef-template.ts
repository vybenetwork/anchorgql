import { gql } from 'apollo-server-express';

export const typeDefs = gql`
    scalar JSON
    scalar BigInt
    scalar Void
///--------------------///

    type Config {
        programId: String
    }
`;
