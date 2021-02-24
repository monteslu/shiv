
const config = require('./config');
const { createConnection } = require('./connection');

config.connections.forEach((conConfig) => {
  const con = createConnection(conConfig);
});