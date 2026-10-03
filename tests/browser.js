// Abre o Chromium com o endereço do script apontando para o servidor de teste.
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const EXEC = 'https://script.google.com/macros/s/TESTE/exec';
const L = 'http://localhost:' + (process.env.PORT || 8099);
const dump = async () => (await fetch(L + '/__dump')).json();
const results = { pass: 0, fail: 0 };
const ok = (c, m, extra) => {
  console.log((c ? '  ok    ' : '  FALHOU ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  if (c) results.pass++; else { results.fail++; process.exitCode = 1; }
};
async function browser() {
  const exe = '/opt/pw-browsers/chromium';
  const b = await pw.chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route(/fonts\.|cdn\.jsdelivr/, r => r.abort());
  await ctx.route(EXEC, async r => {
    try {
      const res = await fetch(L + '/exec', { method: 'POST', body: r.request().postData() || undefined });
      await r.fulfill({ status: res.status, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: await res.text() });
    } catch (e) { await r.abort('connectionfailed'); }
  });
  return { b, ctx };
}
async function connect(p) {
  await p.goto(L + '/');
  await p.fill('[name=url]', EXEC); await p.fill('[name=key]', 'chave-teste-123'); await p.click('#connForm .primary');
  try { await p.waitForSelector('#boot', { state: 'hidden' }); }
  catch (e) { throw new Error('não conectou: "' + (await p.textContent('#connErr').catch(() => '?')) + '"'); }
}
// Espera a fila de envio esvaziar (o aviso sozinho pode ser lido antes de o envio começar).
const saved = p => p.waitForFunction(() => window.__caixa.pending() === 0 && /Tudo salvo/.test(document.querySelector('#sync').textContent));
const pageErrors = p => p.on('pageerror', e => ok(false, 'erro de JavaScript na página: ' + e.message));
module.exports = { browser, connect, dump, ok, saved, pageErrors, EXEC, L, results };
