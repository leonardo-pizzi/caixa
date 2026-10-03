// Roda todos os testes: node tests/run.js (ou npm test).
const { start } = require('./sim/server');
const { results } = require('./browser');
const TESTS = [['Script (banco de dados)', './script.test'], ['Básico', './basico.test'], ['Fixas', './fixas.test']];
(async () => {
  const srv = await start(Number(process.env.PORT || 8099));
  for (const [nome, file] of TESTS) {
    console.log('\n' + nome);
    await fetch('http://localhost:' + (process.env.PORT || 8099) + '/__reset');
    try { await require(file)(); } catch (e) { console.log('  FALHOU com erro: ' + (e.stack || e)); results.fail++; }
  }
  srv.close();
  console.log(`\n${results.pass} ok, ${results.fail} falharam`);
  process.exit(results.fail ? 1 : 0);
})();
