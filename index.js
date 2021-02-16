const mqtt = require('mqtt');
const net = require('net');

const {
  PORT,
  LOCAL_HOST,
  SHIV_BASE,
  SHIV_SERVER,
  SHIV_PATH,
  SHIV_SECRET,
} = require('./config');

const connectURL = `${SHIV_SERVER}${SHIV_SERVER.endsWith('/') ? '' : '/'}${SHIV_BASE}${SHIV_PATH}`;

console.log('connecting to', connectURL, ' …' );

const username = (new URL(connectURL)).hostname;

const mqClient  = mqtt.connect(connectURL, { password: SHIV_SECRET, username });

const sockets = {};

mqClient.on('connect', () => {
  console.log('connected to shiv-server');
});

mqClient.on('error', (error) => {
  console.log('error on mqclient', error);
});

mqClient.on('message', (topic, message) => {
  // message is Buffer
console.log('\n↓ MQTT' , topic);//, Object.keys(sockets).length);

  if (topic?.startsWith('web/')) {
    const socketId = topic.split('/')[2];
    if (socketId) {
      let socket = sockets[socketId];
      if (!socket) {
        socket = new net.Socket();
        socket.socketId = socketId;
        sockets[socketId] = socket;
        socket.connect(PORT, LOCAL_HOST, () => {
          console.log(`\nCONNECTED TO ${LOCAL_HOST}:${PORT}`, socket.socketId);
          // console.log('\nWRITING:');
          console.log('← ' + message.slice(0, 200).toString().split('\r\n')[0], message.length);
          socket.write(message);
        });
        socket.on('data', (data) => {
          if (!socket.dataRecieved) {
            const logData = data.slice(0, 200).toString().split('\r\n')[0];
            console.log(`↑ ${logData}${logData.length > 60 ? '…' : ''}`, data.length);
            socket.dataRecieved = true;
          } else {
            console.log(`→ ${socket.socketId}`, data.length, '↑');
          }
          
          mqClient.publish(`reply/${username}/${socketId}`, data);
        });
        socket.on('close', () => {
          delete sockets[socket.socketId];
        });
        socket.on('error', (err) => {
          delete sockets[socket.socketId];
          console.log('error connecting', LOCAL_HOST, PORT, err);
        });
      } else {
        console.log('←', message.length);
        socket.write(message);
      }
    }
    
  }
})