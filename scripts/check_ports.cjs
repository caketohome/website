const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(false); // Port in use
    });
    server.once('listening', () => {
      server.close();
      resolve(true); // Port free
    });
    server.listen(port, '127.0.0.1');
  });
}

async function check() {
  console.log('Port 3000 free?', await checkPort(3000));
  console.log('Port 9000 free?', await checkPort(9000));
  console.log('Port 5433 free?', await checkPort(5433));
}

check();
