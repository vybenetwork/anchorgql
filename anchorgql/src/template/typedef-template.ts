import { gql } from 'apollo-server-express';

export const typeDefs = gql`
    scalar JSON
    scalar BigInt
    scalar Void
    scalar Byte
///--------------------///

    type Config {
        programId: String
    }
`;
