const mqtt = require('mqtt');
const net = require('net');
const EventEmitter = require('events').EventEmitter;


async function createConnection(config) {
  const events = new EventEmitter();

  const {
    SHIV_SERVER,
    SHIV_SECRET,
    LOCAL_HOST,
    PORT,
    SHIV_BASE,
    SHIV_PATH,
    SHIV_KEEP_ALIVE
  } = config;

  let lastConnect;


  const connectURL = `${SHIV_SERVER}${SHIV_SERVER.endsWith('/') ? '' : '/'}${SHIV_BASE}${SHIV_PATH}`;

  console.log('connecting to', connectURL, '…' );

  const username = (new URL(connectURL)).hostname;

  const mqClient  = mqtt.connect(connectURL, { password: SHIV_SECRET, username, keepalive: SHIV_KEEP_ALIVE });

  events.mqClient = mqClient;

  const sockets = {};

  mqClient.on('connect', () => {
    const now = Date.now();
    console.log('connected to', username, lastConnect ? (now - lastConnect) : '', lastConnect ? 'since last connect' : '');
    lastConnect = now;
    events.emit('connected', config);
  });

  mqClient.on('error', (error) => {
    console.log('error on mqclient', username, error);
  });

  mqClient.on('message', (topic, message) => {
    if (!topic) {
      return;
    }
    // message is Buffer
    const [name, hostName, socketId, action] = topic.split('/');
    console.log('\n↓ MQTT' , topic);
    if (name === 'web') {
      if (socketId) {
        let socket = sockets[socketId];
        if (action === 'close') {
          if (socket) {
            socket.end();
            delete sockets[socket.socketId];
            return;
          }
          return;
        } else if (!socket) {
          socket = new net.Socket();
          socket.socketId = socketId;
          sockets[socketId] = socket;
          socket.connect(PORT, LOCAL_HOST, () => {
            console.log(`\nCONNECTED TO ${LOCAL_HOST}:${PORT}`, socket.socketId);
            console.log('← ' + message.slice(0, 200).toString().split('\r\n')[0], message.length);
            socket.write(message);
          });
          socket.on('data', (data) => {
            if (!socket.dataRecieved) {
              const logData = data.slice(0, 200).toString().split('\r\n')[0];
              console.log(`↑ ${logData}${logData.length > 60 ? '…' : ''}`);//, data.toString());
              socket.dataRecieved = true;
            } else {
              console.log(`→ ${socket.socketId}`, data.length, '↑');
            }
            
            mqClient.publish(`reply/${username}/${socketId}`, data);
          });
          socket.on('close', () => {
            console.log('close', username, socket.socketId);
            mqClient.publish(`close/${username}/${socketId}`, '');
            delete sockets[socket.socketId];
          });
          socket.on('error', (err) => {
            delete sockets[socket.socketId];
            console.log('error connecting', LOCAL_HOST, PORT, err);
          });
          return;
        }

        console.log('←', socketId, message.length);
        socket.write(message);
      }
      
    } else if (name === 'msg') {
      if (action === 'json') {
        try {
          const msg = JSON.parse(data.toString());
          events.emit('json', msg);
        } catch (e) {
          console.log('error parsing json message');
        }
      }
    }

  });

  function sendJson(host, json) {
    if (!host || !json) {
      return;
    }

    if (host === username) {
      console.log('cannot send message to self', host);
    }

    if (typeof json === 'object') {
      json = JSON.stringify(json);
    } else if (typeof json === 'string') {
      try {
        json = JSON.stringify(JSON.parse(json));
      } catch(e) {
        console.log('not well formed json or object', e);
        return;
      }
    } else {
      return;
    }
    mqClient.publish(`msg/${host}/0/json`, json);
  }
  
  events.sendJson = sendJson;

  return events;

}

module.exports = {
  createConnection,
};


