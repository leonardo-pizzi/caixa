// Conexão, lançamento, categoria nova, sem internet, exclusão e envio repetido.
const { browser, dump, ok, saved, pageErrors, EXEC, L } = require('./browser');
module.exports = async function () {
  const { b, ctx } = await browser();
  const p = await ctx.newPage();
  pageErrors(p);
  await p.goto(L + '/');
  await p.waitForSelector('#connForm');
  ok(true, 'tela de conexão aparece');
  await p.fill('[name=url]', EXEC); await p.fill('[name=key]', 'errada'); await p.click('#connForm .primary');
  await p.waitForFunction(() => /incorreta/.test(document.querySelector('#connErr').textContent));
  ok(true, 'chave errada é recusada');
  await p.fill('[name=key]', 'chave-teste-123'); await p.click('#connForm .primary');
  await p.waitForSelector('#boot', { state: 'hidden' });
  ok(await p.isVisible('text=Vamos começar'), 'app abre após conectar');

  // novo lançamento
  await p.click('.newbtn');
  await p.fill('[name=valor]', '120,50'); await p.fill('[name=descricao]', 'Mercado');
  // nova categoria
  await p.selectOption('[name=categoria]', '__new');
  await p.waitForSelector('#pf');
  ok(true, '"+ Nova categoria" abre a janela');
  await p.fill('#pf [name=v]', 'Academia'); await p.click('#pf .primary');
  await p.waitForSelector('#pf', { state: 'detached' });
  ok(await p.inputValue('[name=categoria]') === 'Academia', 'categoria nova fica selecionada');
  await p.click('#txForm button[type=submit]');
  await saved(p);
  let d = await dump();
  ok(d.tx.length === 1 && d.tx[0].valor === 120.5 && d.tx[0].categoria === 'Academia', 'lançamento chegou na planilha', d.tx);
  ok(d.cats.some(c => c.nome === 'Academia'), 'categoria nova chegou na planilha');

  // sem conexão
  await fetch(L + '/__down');
  await p.click('.newbtn');
  await p.fill('[name=valor]', '50'); await p.fill('[name=descricao]', 'Farmácia offline');
  await p.click('#txForm button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#sync').classList.contains('bad'));
  ok(true, 'aviso de "guardado neste aparelho" aparece: ' + await p.textContent('#sync'));
  await p.reload();
  await p.waitForSelector('#boot', { state: 'hidden' });
  ok(await p.isVisible('text=Farmácia offline') || (await p.click('[data-v=lanc]'), await p.isVisible('text=Farmácia offline')), 'após recarregar sem rede, o lançamento continua lá');
  ok((await dump()).tx.length === 1, 'planilha ainda não recebeu (sem rede)');
  await fetch(L + '/__up');
  await p.click('#sync');
  await saved(p);
  d = await dump();
  ok(d.tx.length === 2, 'ao voltar a rede, a alteração pendente foi enviada');

  // marcar como pago e excluir
  const id = d.tx.find(t => t.descricao === 'Mercado').id;
  await p.evaluate(() => { window.__caixa.S.view = 'lanc'; window.__caixa.render(); });
  await p.click(`.row[data-id="${id}"]`);
  await p.click('#txForm [data-act=delete]');
  await p.click('#modal .btn.solid');
  await p.waitForFunction(() => /Tudo salvo/.test(document.querySelector('#sync').textContent) && !window.__caixa.S.tx.some(t => t.descricao === 'Mercado'));
  await new Promise(r => setTimeout(r, 300));
  ok((await dump()).tx.length === 1, 'exclusão chegou na planilha');

  // envio repetido não duplica
  const row = (await dump()).tx[0];
  for (let i = 0; i < 2; i++) await fetch(L + '/exec', { method: 'POST', body: JSON.stringify({ key: 'chave-teste-123', action: 'addTx', args: [[row]] }) });
  ok((await dump()).tx.length === 1, 'envio repetido não duplica lançamento');

  // migração: roda uma vez, depois de um backup, e não apaga nada
  const migrar = () => p.evaluate(() => {
    MIGRATIONS.push({ v: 1, nome: 'origem', run: () => {
      const patches = S.tx.filter(t => !t.origem).map(t => ({ id: t.id, origem: 'manual' }));
      patches.forEach(x => { S.tx.find(t => t.id === x.id).origem = x.origem; });
      return patches.length ? [['update', 'Lancamentos', patches]] : [];
    } });
    return migrate();
  });
  await migrar(); await saved(p);
  d = await dump();
  const copias = await (await fetch(L + '/__copias')).json();
  ok(d.tx.every(t => t.origem === 'manual') && d.cfg.versaoDados === '1', 'migração converte os dados e anota a versão');
  ok(copias.some(n => /antes da migração 1/.test(n)), 'migração faz backup antes');
  await p.reload(); await p.waitForSelector('#boot', { state: 'hidden' }); await saved(p);
  await migrar(); await saved(p);
  ok((await (await fetch(L + '/__copias')).json()).length === copias.length, 'migração já feita não roda de novo');
  await b.close();
};
