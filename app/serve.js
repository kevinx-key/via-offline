// Standalone launcher: serves the offline VIA build on localhost and prints the URL.
// Usage: node serve.js [port]
const path = require('path');
const {createStaticServer} = require('./server');

const port = Number(process.argv[2] || 17800);
const host = '127.0.0.1';

createStaticServer(path.join(__dirname, 'dist')).listen(port, host, () => {
  console.log(`VIA (offline) served at http://${host}:${port}/`);
});
