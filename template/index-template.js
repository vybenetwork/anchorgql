const { ApolloServer } = require('apollo-server');
const {getData, postData} = require('./helpers');

const {typeDefs} = require('./root.js')
// replace with actual REST endpoint
const restAPIEndpoint = '__URL__';

const resolvers = {
    Query:{
        __PROJECTNAME__:()=>({})
    },
    Root: {

        ///--------------------///


        __ACCOUNTNAME__:   async () => {
                return (await getData(restAPIEndpoint + '/__ACCOUNTNAME__' )).results;
            },

        
        ///--------------------///


        config: async () => {
            console.log()
            return (await getData(restAPIEndpoint + '/config' )).results;
            }
        }
};

const schema = new ApolloServer({ typeDefs, resolvers });

schema.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
    console.log(`schema ready at ${url}`);
});