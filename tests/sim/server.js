// Servidor de teste: entrega o site e simula o endereço /exec do Apps Script.
// /__down e /__up simulam queda de conexão; /__dump mostra a planilha; /__reset recomeça do zero.
const http = require('http'), fs = require('fs'), path = require('path');
const { makeGAS } = require('./gas');
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

function start(port) {
  let G, down = false;
  const reset = () => { G = makeGAS(); G.setup(); down = false; };
  reset();
  const srv = http.createServer((req, res) => {
    if (req.url === '/__down') { down = true; return res.end('down'); }
    if (req.url === '/__up') { down = false; return res.end('up'); }
    if (req.url === '/__reset') { reset(); return res.end('reset'); }
    if (req.url === '/__copias') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(G.DriveApp.copies)); }
    if (req.url === '/__dump') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(G.api_load())); }
    if (req.url.startsWith('/exec')) {
      if (down) return req.socket.destroy();
      let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const out = req.method === 'POST' ? G.doPost({ postData: { contents: b } }) : G.doGet();
        res.setHeader('content-type', 'application/json'); res.end(out.t);
      });
      return;
    }
    const f = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream');
    res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
}
module.exports = { start };
