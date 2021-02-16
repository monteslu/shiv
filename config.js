module.exports = {
  SHIV_SECRET: process.env.SHIV_SECRET, // keep it secret, keep it safe!
  LOCAL_HOST: process.env.LOCAL_HOST || 'localhost', // host of local server
  PORT: process.env.PORT || 3000, // port of local server
  SHIV_BASE: process.env.SHIV_BASE || 'shiv',
  SHIV_PATH: process.env.SHIV_PATH || '',
  SHIV_SERVER: process.env.SHIV_SERVER || 'ws://localhost:3001',
};