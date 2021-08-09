const { ApolloServer } = require('apollo-server');
const {getData, postData} = require('./helpers');

const {typeDefs} = require('./types/root.js')
// replace with actual REST endpoint
const restAPIEndpoint = 'https://stake-restapi1-2skizcvneq-uc.a.run.app';

const resolvers = {
    Query:{
        serumStake:()=>({})
    },
    Root: {
        rewardVendor:   async () => {
                return (await getData(restAPIEndpoint + '/rewardVendor' )).results;
            },

        rewardQueue:   async () => {
            return (await getData(restAPIEndpoint + '/rewardQueue' )).results;
        },

        member:   async () => {
                return (await getData(restAPIEndpoint + '/member' )).results;
            },

        pendingWithdrawal:   async () => {
            return (await getData(restAPIEndpoint + '/pendingWithdrawal' )).results;
            },

        registrar:   async () => {
            return (await getData(restAPIEndpoint + '/registrar' )).results;
            },
            
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