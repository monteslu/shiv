const baseConfig = {
  SHIV_SERVER: process.env.SHIV_SERVER || 'ws://localhost:3101',
  SHIV_SECRET: process.env.SHIV_SECRET, // keep it secret, keep it safe!
  LOCAL_HOST: process.env.LOCAL_HOST || 'localhost', // host of local server
  PORT: process.env.PORT || 3000, // port of local server
  SHIV_BASE: process.env.SHIV_BASE || '_sh',
  SHIV_KEEP_ALIVE: parseInt(process.env.SHIV_KEEP_ALIVE) || 60,
};


const connections = [baseConfig];
const keys = Object.keys(process.env);
keys.forEach((k) => {
  if(k.startsWith('SHIV_SERVER_')) {
    const name = k.substring(12);
    const value = process.env[k];
    if (name && value) {
      connections.push({
        name,
        SHIV_SERVER: value,
        SHIV_SECRET: process.env['SHIV_SECRET_' + name] || baseConfig.SHIV_SECRET,
        LOCAL_HOST: process.env['LOCAL_HOST_' + name] || baseConfig.LOCAL_HOST,
        PORT: process.env['PORT_' + name] || baseConfig.PORT,
        SHIV_BASE: process.env['SHIV_BASE_' + name] || baseConfig.SHIV_BASE,
        SHIV_KEEP_ALIVE: parseInt(process.env['SHIV_KEEP_ALIVE_' + name]) || baseConfig.SHIV_KEEP_ALIVE,
      })
    }
  }
})

const config = Object.assign({}, baseConfig, {connections});

module.exports = config;