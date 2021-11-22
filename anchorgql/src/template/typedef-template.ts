import { gql } from 'apollo-server-express';

export const typeDefs = gql`
    scalar JSON
    scalar BigInt
///--------------------///

    type Config {
        programId: String
    }
`;
