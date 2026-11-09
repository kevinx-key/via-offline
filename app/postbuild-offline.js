// Post-build step for the fully offline build:
// rewrite three.js / drei's Draco decoder CDN path to the copy shipped in /draco/.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
const FROM = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';
const TO = '/draco/';

let patched = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|css|html)$/.test(entry.name)) {
      const src = fs.readFileSync(p, 'utf8');
      if (src.includes(FROM)) {
        fs.writeFileSync(p, src.split(FROM).join(TO), 'utf8');
        patched++;
        console.log('patched', path.relative(dist, p));
      }
    }
  }
};

walk(dist);
if (!fs.existsSync(path.join(dist, 'draco', 'draco_decoder.wasm'))) {
  console.error('ERROR: dist/draco/draco_decoder.wasm missing');
  process.exit(1);
}
console.log(`done, files patched: ${patched}`);
