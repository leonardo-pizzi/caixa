// Garantias do script (banco de dados universal), sem navegador:
// trocar o script não perde dados; nenhum campo se perde; abas e colunas novas
// aparecem sozinhas; a ordem das colunas não importa; dicionário e backup.
const path = require('path');
const { makeGAS, post } = require('./sim/gas');
const { ok } = require('./browser');
const SCHEMA = require('./schema');

module.exports = async function () {
  // 1. planilha criada e usada pela primeira versão publicada do script
  const V1 = makeGAS(path.join(__dirname, 'fixtures', 'Code_v1.gs')); V1.setup();
  post(V1, 'addTx', [[{ id: 'a1', data: '2026-10-01', descricao: 'Mercado', tipo: 'Despesa', categoria: 'Mercado', valor: 120.5, forma: 'Pix', modo: 'unica', parcela: 1, total: 1, grupo: 'g1', vencimento: '2026-10-01', status: 'Pago' }]]);
  post(V1, 'saveCard', [{ id: 'c1', nome: 'Nubank', fechamento: 25, vencimento: 5, limite: 5000, cor: '#17604F', ativo: true }]);
  post(V1, 'saveCfg', [{ saldoInicial: 2500, dataInicio: '2026-01-01' }]);

  // 2. troca pelo script atual mantendo a mesma planilha e as mesmas propriedades
  const G = makeGAS(null, V1.__ss, V1.__props);
  const d = post(G, 'load', [], SCHEMA).data;
  ok(d.tx.length === 1 && d.tx[0].valor === 120.5 && d.tx[0].data === '2026-10-01', 'trocar o script mantém os lançamentos');
  ok(d.cards[0].nome === 'Nubank' && d.cards[0].ativo === true && d.cfg.saldoInicial === 2500, 'trocar o script mantém cartões e ajustes');
  ok(d.cats.length === 18 && Array.isArray(d.rules), 'categorias mantidas e aba Recorrencias criada');

  // 3. nenhum campo se perde
  post(G, 'update', ['Lancamentos', [{ id: 'a1', loja: 'Atacadão', cashback: 2.4 }]], SCHEMA);
  let t = post(G, 'load', [], SCHEMA).data.tx[0];
  ok(t.loja === 'Atacadão' && t.cashback === 2.4, 'campo novo enviado sem declarar vira coluna (com tipo número)', t);
  post(G, 'updateTx', [[{ id: 'a1', status: 'Pendente' }]], SCHEMA);
  t = post(G, 'load', [], SCHEMA).data.tx[0];
  ok(t.loja === 'Atacadão' && t.status === 'Pendente', 'alterar outro campo não apaga o campo novo');
  post(G, 'update', ['Cartoes', [{ id: 'c1', banco: 'Nu Pagamentos' }]], SCHEMA);
  post(G, 'saveCard', [{ id: 'c1', nome: 'Nubank Ultravioleta', fechamento: 25, vencimento: 5, limite: 9000, cor: '#17604F', ativo: true }], SCHEMA);
  const c = post(G, 'load', [], SCHEMA).data.cards[0];
  ok(c.nome === 'Nubank Ultravioleta' && c.banco === 'Nu Pagamentos', 'salvar um cartão por uma tela que não conhece "banco" não apaga o campo', c);
  const cats = post(G, 'load', [], SCHEMA).data.cats;
  post(G, 'update', ['Categorias', [{ nome: 'Mercado', tipo: 'Despesa', icone: 'carrinho' }]], SCHEMA);
  post(G, 'saveCats', [cats.concat([{ nome: 'Alimentação', tipo: 'Receita', cor: '#0E7A5C' }])], SCHEMA);
  const cats2 = post(G, 'load', [], SCHEMA).data.cats;
  ok(cats2.find(x => x.nome === 'Mercado').icone === 'carrinho', 'regravar as categorias mantém campos extras');
  ok(cats2.filter(x => x.nome === 'Alimentação').length === 2, 'mesmo nome como despesa e receita convivem (chave nome + tipo)');

  // 4. abas novas e esquema lembrado
  const S2 = Object.assign({}, SCHEMA, { Metas: { headers: ['id', 'nome', 'alvo', 'prazo'], num: ['alvo'], fields: { alvo: 'Quanto juntar' } } });
  ok(post(G, 'add', ['Metas', [{ id: 'm1', nome: 'Viagem', alvo: 8000, prazo: '2027-07' }]], S2).ok, 'aba nova declarada pelo site é criada');
  const semEsquema = post(G, 'load', []).data.tables.Metas;
  ok(semEsquema && semEsquema[0].alvo === 8000, 'o script lembra abas e tipos mesmo num pedido sem esquema');
  post(G, 'add', ['Metas', [{ id: 'm1', nome: 'Duplicada', alvo: 1 }]], S2);
  ok(post(G, 'load', [], S2).data.tables.Metas.length === 1, 'reenviar a mesma linha não duplica');

  // 5. a ordem das colunas na planilha não importa (alguém reorganizou à mão)
  const sh = G.__ss.getSheetByName('Cartoes');
  sh.d = sh.d.map(r => { const x = r.slice(); const a = x[1]; x[1] = x[4]; x[4] = a; return x; });
  const G2 = makeGAS(null, G.__ss, G.__props);
  const c2 = post(G2, 'load', [], SCHEMA).data.cards[0];
  ok(c2.nome === 'Nubank Ultravioleta' && c2.limite === 9000, 'colunas trocadas de lugar continuam lidas pelo nome', c2);

  // 6. dicionário, backup e proteções
  const dic = G.__ss.getSheetByName('_Dicionario');
  const linhas = dic ? dic.d.map(r => r.join('|')) : [];
  ok(linhas.some(l => /^Lancamentos\|vencimento\|texto\|\|Quando o dinheiro/.test(l)), 'aba _Dicionario descreve cada campo');
  ok(linhas.some(l => /^Categorias\|tipo\|texto\|sim\|/.test(l)), 'dicionário mostra a chave de cada aba');
  const bk = post(G, 'backup', ['teste'], SCHEMA);
  ok(bk.ok && G.DriveApp.copies.some(n => /\(teste\)$/.test(n)), 'backup sob demanda cria uma cópia no Drive');
  ok(post(G, 'add', ['Config', [{ chave: 'x' }]], SCHEMA).rejected, 'aba Config só muda pelos Ajustes');
  ok(post(G, 'add', ['_Dicionario', [{ aba: 'x' }]], SCHEMA).rejected, 'aba _Dicionario não é mexida pelo site');
  ok(post(G, 'setStatus', [['a1'], 'Xyz'], SCHEMA).rejected, 'dado inválido é recusado');
  const out = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ key: 'errada', action: 'load' }) } }).t);
  ok(out.auth && !out.data, 'sem a chave não se lê nada');
};
