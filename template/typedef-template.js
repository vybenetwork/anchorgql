const { gql } = require('apollo-server-express')


const typeDefs = gql`


///--------------------///

type Config {
    provider: String
    programId: String
    anchorVersion: String
}
`

module.exports ={typeDefs}