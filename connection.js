const mqtt = require('mqtt');
const net = require('net');
const rawr = require('rawr');
const b64id = require('b64id');
const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('shiv:info');
const debugVerbose = require('debug')('shiv:verbose');
const debugError = require('debug')('shiv:error');

debug.color = 3;
debugVerbose.color = 2;
debugError.color = 1;

function createConnection(config) {
  const events = new EventEmitter();

  const {
    SHIV_SERVER,
    SHIV_SECRET,
    LOCAL_HOST,
    PORT,
    SHIV_BASE,
    SHIV_KEEP_ALIVE
  } = config;

  let lastConnect;


  const connectURL = `${SHIV_SERVER}${SHIV_SERVER.endsWith('/') ? '' : '/'}${SHIV_BASE}`;

  debug('connecting to', connectURL, '…' );

  const username = (new URL(connectURL)).hostname;

  const mqClient  = mqtt.connect(connectURL, { password: SHIV_SECRET, username, keepalive: SHIV_KEEP_ALIVE });
  mqClient.username = username;

  events.mqClient = mqClient;

  const sockets = {};

  mqClient.on('connect', () => {
    const now = Date.now();
    debug('connected to', username, lastConnect ? (now - lastConnect) : '', lastConnect ? 'since last connect' : '');
    lastConnect = now;
    events.emit('connected', config);
  });

  mqClient.on('error', (error) => {
    debugError('error on mqclient', username, error);
  });

  mqClient.on('message', (topic, message) => {
    if (!topic) {
      return;
    }
    // message is Buffer
    const [name, hostName, socketId, action] = topic.split('/');
    debugVerbose('\n↓ MQTT' , topic);
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
            debugVerbose(`\nCONNECTED TO ${LOCAL_HOST}:${PORT}`, socket.socketId);
            debugVerbose('← ' + message.slice(0, 200).toString().split('\r\n')[0], message.length);
            socket.write(message);
          });
          socket.on('data', (data) => {
            if (!socket.dataRecieved) {
              const logData = data.slice(0, 200).toString().split('\r\n')[0];
              debugVerbose(`↑ ${logData}${logData.length > 60 ? '…' : ''}`);
              socket.dataRecieved = true;
            } else {
              debugVerbose(`→ ${socket.socketId}`, data.length, '↑');
            }
            
            mqClient.publish(`reply/${username}/${socketId}`, data);
          });
          socket.on('close', () => {
            debugVerbose('close', username, socket.socketId);
            mqClient.publish(`close/${username}/${socketId}`, '');
            delete sockets[socket.socketId];
          });
          socket.on('error', (err) => {
            delete sockets[socket.socketId];
            debugError('error connecting', LOCAL_HOST, PORT, err);
          });
          return;
        }

        debugVerbose('←', socketId, message.length);
        socket.write(message);
      }
      
    } else if (name === 'msg') {
      if (action === 'json') {
        try {
          const msg = JSON.parse(message.toString());
          msg.from = socketId;
          events.emit('json', msg);
        } catch (e) {
          debugError('error parsing json message');
        }
      } else if (action === 'ssrpc') {
        const peer = getServerReplyPeer(socketId, mqClient);
        peer.transport.receiveData(message.toString());
      }
    }

  });

  function sendJson(host, json) {
    if (!host || !json) {
      return;
    }

    if (host === username) {
      debugError('cannot send message to self', host);
    }

    if (typeof json === 'object') {
      json = JSON.stringify(json);
    } else if (typeof json === 'string') {
      try {
        json = JSON.stringify(JSON.parse(json));
      } catch(e) {
        debugError('not well formed json or object', e);
        return;
      }
    } else {
      return;
    }
    mqClient.publish(`msg/${host}/${username}/json`, json);
  }

  function endSockets() {
    const sockKeys = Object.keys(sockets);
    sockKeys.forEach((sk) => {
      try {
        sockets[sk].end();
        delete sockets[sk];
      }
      catch(e) {
        debugError('error closing socket', e);
      }
    });
  }

  function endClient(force, callback) {
    if (force) {
      mqClient.end(force);
      endSockets();
      return;
    }
    mqClient.end(force, (a, b) => {
      endSockets();
      if (callback) {
        callback(a, b);
      }
    })
  }

  function ping(greeting) {
    return greeting + ' back atcha from client ' + Date.now();
  }

  const serverReplyMethods = {
    ping,
  };

  function getServerReplyPeer(requestId, client) {

    const transport = new EventEmitter();
    transport.send = (msg) => {
      if(typeof msg === 'object') {
        msg = JSON.stringify(msg);
      }
      const topic = `ssrpc/${client.username}/${requestId}`;
      debugVerbose('↑ server rpc reply', msg);
      client.publish(topic, Buffer.from(msg));
    };
    transport.receiveData = (msg) => {
      debugVerbose('↓ server rpc', msg);
      if(msg) {
        msg = JSON.parse(msg);
      }
      transport.emit('rpc', msg);
    };

    const peer = rawr({transport, methods: serverReplyMethods});
    return peer;
  }
  
  events.sendJson = sendJson;
  events.endClient = endClient;
  events.serverReplyMethods = serverReplyMethods;

  return events;

}

module.exports = {
  createConnection,
};
