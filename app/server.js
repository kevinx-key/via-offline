// Tiny static file server used by both the Electron shell and the standalone launcher.
// Serves the built VIA single-page app from `root` and never reaches the network.
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

function createStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  return http.createServer((req, res) => {
    let pathname = decodeURIComponent(url.parse(req.url).pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const filePath = path.join(root, pathname);
    // Block path traversal outside of the app directory.
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.writeHead(403, {'Content-Type': 'text/plain'}).end('forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Single-page app: unknown extension-less routes fall back to index.html.
        if (!path.extname(filePath)) {
          fs.readFile(path.join(root, 'index.html'), (indexErr, indexData) => {
            if (indexErr) {
              res.writeHead(404, {'Content-Type': 'text/plain'}).end('not found: ' + pathname);
              return;
            }
            res.writeHead(200, {'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache'});
            res.end(indexData);
          });
          return;
        }
        res.writeHead(404, {'Content-Type': 'text/plain'}).end('not found: ' + pathname);
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

module.exports = {createStaticServer};
