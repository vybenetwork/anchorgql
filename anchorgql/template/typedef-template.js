const { gql } = require('apollo-server-express')


const typeDefs = gql`
scalar JSON


///--------------------///

type Config {
    provider: String
    programId: String
}
`

module.exports ={typeDefs}