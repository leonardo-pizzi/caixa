/* Caixa — Estado, armazenamento no aparelho, fila de envio e comunicação com a planilha. */
'use strict';

/* =====================================================================
   Estado e comunicação com o servidor
   ===================================================================== */
const S = {
  cfg: { saldoInicial: 0, dataInicio: '' }, cards: [], cats: [], tx: [], rules: [], extra: {}, ssUrl: '', serverV: 1,
  view: 'fluxo', month: today().slice(0, 7),
  lMode: 'data', lq: '', lTipo: '', lCat: '', lStatus: '',
  fRange: 90, aScope: 'mes', aBasis: 'venc'
};
const sg = r => (r.tipo === 'Receita' ? 1 : -1);
const cardById = id => S.cards.find(c => c.id === id);
const cardName = id => { const c = cardById(id); return c ? c.nome : 'Cartão'; };
const activeCards = () => S.cards.filter(c => c.ativo !== false);
function catColor(name) {
  const c = S.cats.find(x => x.nome === name);
  if (c && c.cor) return c.cor;
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
/* ---------- armazenamento no aparelho ---------- */
// Tudo que é alterado fica guardado aqui até a planilha confirmar que recebeu.
const LS = {
  get(k, d) { try { const v = localStorage.getItem('caixa.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('caixa.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
let conn = LS.get('conn', null);   // { url, key } do script na planilha
let queue = LS.get('queue', []);   // alterações ainda não confirmadas pela planilha
let flushing = false, retryTimer = null, syncErr = '', edits = 0;

// Abas e colunas da planilha. O script cria sozinho o que faltar e nunca apaga
// nada, então colunas e abas novas só precisam ser declaradas aqui (veja CLAUDE.md).
// num = número, bool = sim/não, o resto é texto; key = o que identifica a linha (padrão "id").
const SCHEMA = {
  Lancamentos: {
    desc: 'Cada entrada ou saída de dinheiro. Uma compra parcelada ou uma fixa gera uma linha por mês.',
    headers: ['id', 'data', 'descricao', 'tipo', 'categoria', 'valor', 'forma', 'cartaoId', 'modo', 'parcela', 'total', 'grupo', 'vencimento', 'status', 'obs', 'criadoEm'],
    num: ['valor', 'parcela', 'total'],
    fields: {
      id: 'Identificador único da linha', data: 'Data da compra ou do fato (AAAA-MM-DD)', descricao: 'Descrição livre',
      tipo: 'Receita ou Despesa', categoria: 'Nome da categoria (aba Categorias)', valor: 'Valor em reais, sempre positivo',
      forma: 'Pix, Débito, Crédito, Dinheiro, Boleto, Transferência ou Outro', cartaoId: 'id do cartão (aba Cartoes) quando forma = Crédito',
      modo: 'unica, parcelada ou recorrente', parcela: 'Número desta parcela/mês', total: 'Total de parcelas (0 = fixa sem fim)',
      grupo: 'Liga as linhas da mesma compra parcelada ou da mesma fixa (id em Recorrencias)',
      vencimento: 'Quando o dinheiro sai/entra de fato (AAAA-MM-DD); no crédito, o vencimento da fatura',
      status: 'Pago ou Pendente', obs: 'Observação', criadoEm: 'Quando foi registrado (data e hora)'
    }
  },
  Cartoes: {
    desc: 'Cartões de crédito.',
    headers: ['id', 'nome', 'fechamento', 'vencimento', 'limite', 'cor', 'ativo'], num: ['fechamento', 'vencimento', 'limite'], bool: ['ativo'],
    fields: { id: 'Identificador único', nome: 'Nome do cartão', fechamento: 'Dia do mês em que a fatura fecha', vencimento: 'Dia do mês em que a fatura vence',
      limite: 'Limite em reais (0 = não informado)', cor: 'Cor na tela (#RRGGBB)', ativo: 'FALSE = arquivado' }
  },
  Categorias: {
    desc: 'Categorias de receita e de despesa. Identificadas por nome + tipo.',
    headers: ['nome', 'tipo', 'cor'], key: ['nome', 'tipo'],
    fields: { nome: 'Nome da categoria', tipo: 'Receita ou Despesa', cor: 'Cor na tela (#RRGGBB)' }
  },
  Config: {
    desc: 'Ajustes gerais, em pares chave/valor.',
    headers: ['chave', 'valor'], key: 'chave',
    fields: { chave: 'saldoInicial, dataInicio, feriadosNac (1/0), feriadosFac (1/0), feriadosExtras (JSON), versaoDados', valor: 'Valor do ajuste, como texto' }
  },
  Recorrencias: {
    desc: 'Receitas e despesas fixas (regras). As linhas de cada mês ficam em Lancamentos com grupo = id.',
    headers: ['id', 'descricao', 'tipo', 'categoria', 'forma', 'cartaoId', 'valor', 'valorModo', 'refMes', 'diaModo', 'dia', 'sabado', 'inicio', 'fim', 'pulados', 'ajustados', 'valores', 'obs', 'criadoEm'],
    num: ['valor', 'dia'], bool: ['sabado'],
    fields: { id: 'Identificador único', descricao: 'Descrição', tipo: 'Receita ou Despesa', categoria: 'Nome da categoria', forma: 'Forma de pagamento',
      cartaoId: 'id do cartão quando forma = Crédito', valor: 'Valor por mês, ou por dia útil se valorModo = diaUtil', valorModo: 'fixo ou diaUtil',
      refMes: 'Com diaUtil: dias úteis do mesmo mês ou do proximo', diaModo: 'fixo (dia do mês), util (Nº dia útil) ou ultimo (último dia útil)',
      dia: 'Dia do mês ou Nº do dia útil', sabado: 'TRUE = sábado conta como dia útil', inicio: 'Primeiro mês (AAAA-MM)', fim: 'Último mês (AAAA-MM; vazio = sem fim)',
      pulados: 'Meses excluídos, separados por vírgula (AAAA-MM)', ajustados: 'Meses editados à mão, que a regra não altera (AAAA-MM)',
      valores: 'Histórico de reajustes em JSON: [{"desde":"AAAA-MM","valor":0}]', obs: 'Observação', criadoEm: 'Quando foi criada' }
  }
};

class AuthError extends Error {}
class RejectedError extends Error {}

// Chama uma ação do Code.gs. Corpo em texto puro para não exigir pré-verificação de CORS.
async function call(action, args, c) {
  c = c || conn;
  if (!c) throw new AuthError('Conexão não configurada.');
  const res = await fetch(c.url, { method: 'POST', body: JSON.stringify({ key: c.key, action, args: args || [], schema: SCHEMA }) });
  if (!res.ok) throw new Error('A planilha respondeu com erro ' + res.status + '.');
  let j;
  try { j = await res.json(); } catch (e) { throw new Error('Resposta inesperada. Confira o endereço e se a implantação permite acesso a "Qualquer pessoa".'); }
  if (!j.ok) {
    if (j.auth) throw new AuthError(j.error);
    if (j.rejected) throw new RejectedError(j.error);
    throw new Error(j.error);
  }
  return j.data;
}
// Abas com nome próprio em S; as demais (abas novas) ficam em S.extra[aba].
const TABLE_FIELD = { Lancamentos: 'tx', Cartoes: 'cards', Categorias: 'cats', Recorrencias: 'rules' };
// Linhas de qualquer aba, para qualquer tela: rowsOf('Lancamentos'), rowsOf('Metas')…
function rowsOf(aba) { const f = TABLE_FIELD[aba]; return f ? S[f] : (S.extra[aba] = S.extra[aba] || []); }
// Deixa os dados do servidor (ou do aparelho) no mesmo formato de snapshot().
function shape(d) {
  const extra = Object.assign({}, d.extra || {});
  Object.keys(d.tables || {}).forEach(n => { if (!TABLE_FIELD[n]) extra[n] = d.tables[n]; });
  return { v: d.v || 1, cfg: d.cfg || { saldoInicial: 0, dataInicio: '' }, cards: d.cards || [], cats: d.cats || [], tx: d.tx || [],
    rules: d.rules || [], extra, ssUrl: d.ssUrl || '' };
}
function applyData(d) {
  d = shape(d);
  S.cfg = d.cfg; S.cards = d.cards; S.cats = d.cats; S.tx = d.tx; S.rules = d.rules; S.extra = d.extra;
  S.ssUrl = d.ssUrl; S.serverV = d.v;
}
const snapshot = () => ({ v: S.serverV, cfg: S.cfg, cards: S.cards, cats: S.cats, tx: S.tx, rules: S.rules, extra: S.extra, ssUrl: S.ssUrl });
function saveLocal() { LS.set('data', snapshot()); LS.set('queue', queue); }

// Aplica a mudança na tela na hora, guarda no aparelho e envia à planilha.
// ops: ['acao', ...args] ou uma lista delas.
function commit(localFn, ops) {
  localFn();
  edits++;
  (Array.isArray(ops[0]) ? ops : [ops]).forEach(o => queue.push({ a: o[0], args: JSON.parse(JSON.stringify(o.slice(1))) }));
  saveLocal();
  render();
  flush();
}
// Envia a fila em ordem. Sem rede, tenta de novo depois; nada é descartado.
async function flush() {
  if (flushing || !conn) return;
  flushing = true; clearTimeout(retryTimer);
  let rejected = false;
  try {
    while (queue.length) {
      paintSync();
      try { await call(queue[0].a, queue[0].args); }
      catch (e) {
        if (e instanceof RejectedError) {
          // A planilha recusou esta alteração (dado inválido); tirar da fila evita travar as demais.
          rejected = true; toast('A planilha recusou uma alteração: ' + e.message, true);
        } else {
          syncErr = e instanceof AuthError ? 'Chave de acesso recusada.' : 'Sem conexão com a planilha.';
          if (e instanceof AuthError) showConnect(e.message);
          else retryTimer = setTimeout(flush, 15000);
          return;
        }
      }
      queue.shift(); LS.set('queue', queue); syncErr = '';
    }
  } finally { flushing = false; paintSync(); }
  if (rejected) refresh(true);
}
// Busca os dados da planilha (alterações feitas em outro aparelho, por exemplo).
async function refresh(force) {
  if (!conn || queue.length || flushing) return;
  const before = edits;
  try {
    const d = await call('load');
    if (edits !== before || queue.length) return; // houve alteração enquanto carregava
    const changed = JSON.stringify(shape(d)) !== JSON.stringify(snapshot());
    applyData(d); saveLocal(); syncErr = ''; paintSync();
    afterServerData();
    if (changed || force) render();
  } catch (e) {
    if (e instanceof AuthError) return showConnect(e.message);
    syncErr = 'Sem conexão com a planilha.'; paintSync();
  }
}
/* ---------- migrações ---------- */
// Quando o FORMATO de um dado mudar (ex.: renomear um campo, dividir um campo em
// dois), acrescente aqui uma migração com o próximo número. Ela roda uma única vez,
// no primeiro aparelho que abrir o site, logo depois de uma cópia de segurança da
// planilha. A versão fica em Config → versaoDados. Regras (veja CLAUDE.md):
// - não apague o campo antigo: copie para o novo e pare de usar o antigo;
// - precisa poder rodar duas vezes sem estragar nada.
// run() altera S e devolve as alterações para a planilha, no formato do commit().
const MIGRATIONS = [
  // { v: 1, nome: 'exemplo', run: () => { … ; return [['update', 'Lancamentos', patches]]; } },
];
let migrating = false;
async function migrate() {
  const cur = Number(S.cfg.versaoDados || 0), pend = MIGRATIONS.filter(m => m.v > cur).sort((a, b) => a.v - b.v);
  if (!pend.length || migrating || queue.length || S.serverV < 4) return;
  migrating = true;
  try {
    await call('backup', ['antes da migração ' + pend[pend.length - 1].v]);
    pend.forEach(m => {
      const ops = m.run() || [];
      S.cfg = Object.assign({}, S.cfg, { versaoDados: String(m.v) });
      commit(() => {}, ops.concat([['saveCfg', S.cfg]]));
    });
  } catch (e) { /* sem backup não migra; tenta de novo na próxima abertura */ }
  finally { migrating = false; }
}
// Sempre que chegam dados da planilha: completa as fixas e roda migrações pendentes.
function afterServerData() { topUpRules(); migrate(); }

function paintSync() {
  const el = $('#sync');
  if (!el) return;
  const n = queue.length;
  let st = 'ok', txt = 'Tudo salvo na planilha';
  if (n && syncErr) { st = 'bad'; txt = `${n} ${n > 1 ? 'alterações guardadas' : 'alteração guardada'} neste aparelho · ${syncErr} Toque para tentar de novo.`; }
  else if (n) { st = 'busy'; txt = 'Salvando…'; }
  else if (syncErr) { st = 'bad'; txt = syncErr + ' Toque para tentar de novo.'; }
  el.className = 'sync ' + st; el.textContent = txt; el.title = txt;
}
