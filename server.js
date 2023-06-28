const path = require('path');
require('colors');
const dotenv = require('dotenv');

const { createServer } = require('http');

// Import graphql server tools
const { loadFilesSync } = require('@graphql-tools/load-files');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { ApolloServer } = require('apollo-server-express');

// Set enviroment variables
dotenv.config({ path: './config/config.env' });

const app = require('./app');
const errorHandler = require('./middleware/error');
const contextHandler = require('./utils/context');

const { connectDB } = require('./config/db');

// Pull out all schemas and resolvers
const typesArray = loadFilesSync(path.join(__dirname, '**/*.gql'));
const resolversArray = loadFilesSync(path.join(__dirname, '**/resolvers/*.js'));

const PORT = process.env.PORT || 9000;

const schema = makeExecutableSchema({
  typeDefs: typesArray,
  resolvers: resolversArray,
});

const httpServer = createServer(app);

async function startApolloServer() {
  // Connect to the database
  await connectDB();

  // Start the apollo server
  const server = new ApolloServer({
    schema,
    context: contextHandler,
    csrfPrevention: true,
    formatError: errorHandler,
    introspection: true,
    playground: true,
  });

  await server.start();

  let origin = ['https://zipo.me', 'http://localhost:3000'];
  if (process.env.TEST_ENV === 'yes') {
    origin.push(
      'http://localhost:3000',
      'http://localhost:5000',
      'https://studio.apollographql.com'
    );
  }

  const corsOption = {
    credentials: true,
    origin,
  };

  server.applyMiddleware({ app, path: '/graphql', cors: corsOption });

  httpServer.listen(PORT, () => {
    console.log(`GRAPHQL SERVER RUNNING PORT ${PORT} `);
  });
}

// authenticate()
startApolloServer();
