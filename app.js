(function () {
'use strict';

/* =====================================================================
   Utilidades
   ===================================================================== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fmt = v => { v = r2(v); if (Object.is(v, -0) || v === 0) v = 0; return BRL.format(v); };
const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const FORMAS_D = ['Crédito', 'Débito', 'Pix', 'Dinheiro', 'Boleto'];
const FORMAS_R = ['Pix', 'Transferência', 'Dinheiro', 'Outro'];
const SWATCHES = ['#17604F', '#2F5E8E', '#6C4A9E', '#9A3B5C', '#C4402B', '#C26A2B', '#B7770A', '#44546A'];
const PALETTE = ['#17604F', '#C4402B', '#2F5E8E', '#B7770A', '#6C4A9E', '#0E7A8C', '#9A3B5C', '#5E7A2E', '#C26A2B', '#44546A', '#8C6D1F', '#3E8E7E'];

const IC = {
  flow: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  chart: '<path d="M5 20V11M11 20V4M17 20v-6M3 20h18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const icon = (n, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* =====================================================================
   Datas (sempre texto AAAA-MM-DD, sem fuso horário)
   ===================================================================== */
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = s => { const p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const today = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const dmy = s => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
function addMonths(s, n, anchorDay) {
  const p = parse(s);
  const t = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  return iso(y, m, Math.min(anchorDay || p.d, daysIn(y, m)));
}
function addDays(s, n) {
  const p = parse(s);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const shiftYM = (ym, n) => { const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
const monthRange = ym => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return [iso(y, m, 1), iso(y, m, daysIn(y, m))]; };
const monthName = ym => MESES[Number(ym.slice(5, 7)) - 1];
const monthLabel = ym => `${cap(monthName(ym))} de ${ym.slice(0, 4)}`;
function dayLabel(s) {
  const p = parse(s);
  const dt = new Date(p.y, p.m - 1, p.d);
  const wd = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dt.getDay()];
  return `${cap(wd)}, ${p.d} de ${MESES[p.m - 1]}`;
}

/* =====================================================================
   Regras do cartão e parcelas
   ===================================================================== */
// Vencimento da fatura em que cai uma compra feita em purchaseISO.
// Compra até o dia de fechamento (inclusive) entra na fatura que fecha neste mês.
function firstDue(purchaseISO, card) {
  const p = parse(purchaseISO);
  const closeEff = Math.min(card.fechamento, daysIn(p.y, p.m));
  const closeMonth = addMonths(iso(p.y, p.m, 1), p.d > closeEff ? 1 : 0, 1);
  const dueMonth = addMonths(closeMonth, card.vencimento > card.fechamento ? 0 : 1, 1);
  const dp = parse(dueMonth);
  return iso(dp.y, dp.m, Math.min(card.vencimento, daysIn(dp.y, dp.m)));
}
// Data de fechamento da fatura que vence em dueISO.
function closingDateForDue(dueISO, card) {
  const p = parse(dueISO);
  const cm = parse(addMonths(iso(p.y, p.m, 1), card.vencimento > card.fechamento ? 0 : -1, 1));
  return iso(cm.y, cm.m, Math.min(card.fechamento, daysIn(cm.y, cm.m)));
}
function splitCents(total, n) {
  const c = Math.round(total * 100), base = Math.floor(c / n), rem = c - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}
// f: { valor, modo: unica|parcelada|recorrente, n, totalMode: total|parcela, data, vencimento }
function schedule(f) {
  const n = f.modo === 'unica' ? 1 : Math.max(1, Math.min(120, Math.floor(f.n) || 1));
  const amounts = (f.modo === 'parcelada' && f.totalMode === 'total') ? splitCents(f.valor, n) : Array(n).fill(r2(f.valor));
  const vday = parse(f.vencimento).d, dday = parse(f.data).d;
  return amounts.map((v, i) => ({
    valor: v,
    data: f.modo === 'recorrente' ? addMonths(f.data, i, dday) : f.data,
    vencimento: addMonths(f.vencimento, i, vday)
  }));
}
function parseMoney(str) {
  let s = String(str || '').replace(/[^\d,.\-]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isNaN(v) ? 0 : r2(v);
}

/* =====================================================================
   Estado e comunicação com o servidor
   ===================================================================== */
const S = {
  cfg: { saldoInicial: 0, dataInicio: '' }, cards: [], cats: [], tx: [], ssUrl: '',
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

class AuthError extends Error {}
class RejectedError extends Error {}

// Chama uma ação do Code.gs. Corpo em texto puro para não exigir pré-verificação de CORS.
async function call(action, args, c) {
  c = c || conn;
  if (!c) throw new AuthError('Conexão não configurada.');
  const res = await fetch(c.url, { method: 'POST', body: JSON.stringify({ key: c.key, action, args: args || [] }) });
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
function applyData(d) {
  S.cfg = d.cfg || { saldoInicial: 0, dataInicio: '' }; S.cards = d.cards || []; S.cats = d.cats || []; S.tx = d.tx || []; S.ssUrl = d.ssUrl || '';
}
const snapshot = () => ({ cfg: S.cfg, cards: S.cards, cats: S.cats, tx: S.tx, ssUrl: S.ssUrl });
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
    const changed = JSON.stringify(d) !== JSON.stringify(snapshot());
    applyData(d); saveLocal(); syncErr = ''; paintSync();
    if (changed || force) render();
  } catch (e) {
    if (e instanceof AuthError) return showConnect(e.message);
    syncErr = 'Sem conexão com a planilha.'; paintSync();
  }
}
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

/* =====================================================================
   Cálculos: saldo, fluxo e análises
   ===================================================================== */
function saldoHoje() {
  let s = Number(S.cfg.saldoInicial) || 0;
  const di = S.cfg.dataInicio || '0000-00-00';
  S.tx.forEach(r => { if (r.status === 'Pago' && r.vencimento >= di) s += sg(r) * r.valor; });
  return r2(s);
}
// Itens pendentes. Compras no crédito do mesmo cartão e vencimento viram uma "fatura".
function pendingEvents() {
  const map = {}, out = [];
  S.tx.forEach(r => {
    if (r.status === 'Pago') return;
    if (r.forma === 'Crédito' && r.cartaoId) {
      const k = r.cartaoId + '|' + r.vencimento;
      if (!map[k]) { map[k] = { kind: 'fatura', date: r.vencimento, cardId: r.cartaoId, rows: [], valor: 0 }; out.push(map[k]); }
      map[k].rows.push(r); map[k].valor -= r.valor;
    } else {
      out.push({ kind: 'tx', date: r.vencimento, rows: [r], valor: sg(r) * r.valor });
    }
  });
  const t = today();
  out.forEach(e => {
    e.valor = r2(e.valor);
    e.overdue = e.date < t;
    e.label = e.kind === 'fatura' ? 'Fatura ' + cardName(e.cardId) : e.rows[0].descricao;
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.valor - b.valor));
}
function runway(days) {
  const t = today(), evs = pendingEvents(), by = {};
  evs.forEach(e => { const d = e.date < t ? t : e.date; (by[d] = by[d] || []).push(e); });
  let bal = saldoHoje();
  const labels = [], data = [];
  let min = { v: Infinity, d: t };
  for (let i = 0; i <= days; i++) {
    const d = addDays(t, i);
    (by[d] || []).forEach(e => { bal += e.valor; });
    bal = r2(bal);
    labels.push(d); data.push(bal);
    if (bal < min.v) min = { v: bal, d };
  }
  return { labels, data, min };
}
function monthlyTable(n) {
  const di = S.cfg.dataInicio || '0000-00-00';
  const start = today().slice(0, 7);
  let open = Number(S.cfg.saldoInicial) || 0;
  S.tx.forEach(r => { if (r.vencimento >= di && r.vencimento.slice(0, 7) < start) open += sg(r) * r.valor; });
  const out = [];
  for (let i = 0; i < n; i++) {
    const ym = shiftYM(start, i);
    const rows = S.tx.filter(r => r.vencimento.slice(0, 7) === ym && r.vencimento >= di);
    const rec = r2(sumBy(rows.filter(r => r.tipo === 'Receita'), r => r.valor));
    const des = r2(sumBy(rows.filter(r => r.tipo === 'Despesa'), r => r.valor));
    const close = r2(open + rec - des);
    out.push({ ym, open: r2(open), rec, des, close });
    open = close;
  }
  return out;
}
function groupInfo() {
  const g = {};
  S.tx.forEach(r => {
    if (r.modo === 'unica') return;
    const x = g[r.grupo] || (g[r.grupo] = { rows: [], sum: 0, paid: 0, n: 0, first: null });
    x.rows.push(r); x.sum += r.valor; x.n++; if (r.status === 'Pago') x.paid++;
  });
  Object.keys(g).forEach(k => {
    g[k].sum = r2(g[k].sum);
    g[k].first = g[k].rows.slice().sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : a.parcela - b.parcela))[0];
  });
  return g;
}
function faturasOf(card) {
  const map = {}, t = today();
  S.tx.forEach(r => { if (r.cartaoId === card.id && r.forma === 'Crédito') (map[r.vencimento] = map[r.vencimento] || []).push(r); });
  return Object.keys(map).sort().map(due => {
    const rows = map[due];
    const paid = rows.every(x => x.status === 'Pago');
    const closing = closingDateForDue(due, card);
    const st = paid ? 'Paga' : due < t ? 'Vencida' : t > closing ? 'Fechada' : 'Aberta';
    return { due, rows, total: r2(sumBy(rows, x => x.valor)), paid, closing, st };
  });
}

/* =====================================================================
   Gráficos
   ===================================================================== */
let charts = [];
function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) { /* ok */ } }); charts = []; }
function mkChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  charts.push(new Chart(el, cfg));
}
const compact = v => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(v));
function baseOpts(extra) {
  return Object.assign({
    maintainAspectRatio: false, responsive: true,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + (c.dataset.label ? c.dataset.label + ': ' : '') + fmt(c.parsed.y) } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#586861', maxRotation: 0 } },
      y: { grid: { color: '#E1E8E4' }, ticks: { color: '#586861', callback: compact } }
    }
  }, extra || {});
}

/* =====================================================================
   Telas
   ===================================================================== */
function renderRail() {
  const items = [['fluxo', 'flow', 'Fluxo de caixa'], ['lanc', 'list', 'Lançamentos'], ['cartoes', 'card', 'Cartões'], ['analise', 'chart', 'Análise']];
  $('#rail').innerHTML =
    `<div class="brand">caixa<small>suas contas, em dia</small></div>` +
    `<button class="newbtn" data-act="new">${icon('plus')}<span>Novo lançamento</span></button>` +
    items.map(i => `<button class="nav-item ${S.view === i[0] ? 'on' : ''}" data-act="nav" data-v="${i[0]}">${icon(i[1])}<span class="lb">${i[2]}</span></button>`).join('') +
    `<div class="spacer"></div><button id="sync" class="sync" data-act="sync" type="button"></button>` +
    `<button class="nav-item" data-act="settings">${icon('gear')}<span class="lb">Ajustes</span></button>`;
  paintSync();
}
function render() {
  renderRail();
  destroyCharts();
  const fn = { fluxo: viewFluxo, lanc: viewLanc, cartoes: viewCartoes, analise: viewAnalise }[S.view];
  $('#view').innerHTML = fn();
  if (S.view === 'fluxo') drawFluxoCharts();
  if (S.view === 'analise') drawAnaliseCharts();
}
function monthNav(unit) {
  const label = unit === 'ano' ? S.month.slice(0, 4) : monthLabel(S.month);
  return `<div class="monthnav"><button class="icon-btn" data-act="mprev" aria-label="Anterior">${icon('left')}</button><b>${label}</b><button class="icon-btn" data-act="mnext" aria-label="Próximo">${icon('right')}</button></div>`;
}
const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

/* ---------------------------- Fluxo de caixa ---------------------------- */
function viewFluxo() {
  if (!S.tx.length && !S.cards.length && !Number(S.cfg.saldoInicial)) {
    return `<div class="page-head"><div><h1>Fluxo de caixa</h1><div class="sub">Quanto você tem hoje e como o saldo evolui até o fim dos seus compromissos.</div></div></div>
      <div class="panel empty"><h3>Vamos começar</h3>
      <p>Informe o saldo atual das suas contas, cadastre seus cartões e registre o primeiro lançamento.<br>Em seguida este painel mostra o saldo dos próximos dias.</p>
      <button class="btn primary" data-act="settings">Informar saldo inicial</button>
      <button class="btn" data-act="cardnew">Cadastrar cartão</button>
      <button class="btn" data-act="new">Novo lançamento</button></div>`;
  }
  const t = today(), hoje = saldoHoje(), rw = runway(S.fRange), evs = pendingEvents();
  const lim30 = addDays(t, 30);
  const within = evs.filter(e => e.date <= lim30);
  const rec30 = r2(sumBy(within.filter(e => e.valor > 0), e => e.valor));
  const pag30 = r2(sumBy(within.filter(e => e.valor < 0), e => -e.valor));
  const late = evs.filter(e => e.overdue);
  const lateSum = r2(sumBy(late, e => e.valor));
  const firstNeg = rw.data.findIndex(v => v < 0);
  let insight, icls = '';
  if (firstNeg > -1) { icls = 'bad'; insight = `Atenção: o saldo fica negativo em ${dmy(rw.labels[firstNeg])} e chega a ${fmt(rw.min.v)} em ${dm(rw.min.d)}.`; }
  else if (!evs.length) { insight = 'Não há contas pendentes. O saldo fica como está.'; }
  else { icls = 'good'; insight = `O saldo segue positivo nos próximos ${S.fRange} dias. O ponto mais baixo é ${fmt(rw.min.v)}, em ${dm(rw.min.d)}.`; }

  let bal = hoje;
  const horizon = addDays(t, S.fRange);
  const list = evs.filter(e => e.date <= horizon).map(e => { bal = r2(bal + e.valor); return { e, bal }; });
  const rows = list.map(x => {
    const e = x.e;
    const sub = e.kind === 'fatura'
      ? `${e.rows.length} ${e.rows.length > 1 ? 'compras' : 'compra'} no crédito`
      : `${esc(e.rows[0].categoria)} · ${e.rows[0].forma === 'Crédito' ? 'Crédito' : esc(e.rows[0].forma)}`;
    const ids = e.rows.map(r => r.id).join(',');
    return `<div class="ev ${e.overdue ? 'late' : ''}">
      <span>${dm(e.date)}</span>
      <span class="t">${esc(e.label)}${e.overdue ? ' <span class="tag bad">atrasado</span>' : ''}<small>${sub}</small></span>
      <span class="amt ${cls(e.valor)}">${e.valor > 0 ? '+' : ''}${fmt(e.valor)}</span>
      <span class="bal ${x.bal < 0 ? 'neg' : ''}">${fmt(x.bal)}</span>
      <button class="check" data-act="evpay" data-ids="${ids}" title="${e.kind === 'fatura' ? 'Marcar fatura como paga' : e.valor > 0 ? 'Marcar como recebido' : 'Marcar como pago'}">${icon('check', 16)}</button>
    </div>`;
  }).join('');
  const mt = monthlyTable(12);
  const nowYM = today().slice(0, 7);
  return `
  <div class="page-head"><div><h1>Fluxo de caixa</h1><div class="sub">Posição de hoje, ${dmy(t)}, e o que ainda vai entrar e sair.</div></div>
    <div class="controls"><div class="seg" role="group" aria-label="Horizonte">
      ${[30, 60, 90, 180].map(n => `<button class="${S.fRange === n ? 'on' : ''}" data-act="frange" data-v="${n}">${n} dias</button>`).join('')}
    </div></div></div>
  <div class="hero"><div><div class="cap">Saldo hoje</div><div class="big ${hoje < 0 ? 'neg' : ''}">${fmt(hoje)}</div>
    <p class="insight ${icls}">${insight}</p></div></div>
  <div class="strip">
    <div class="cell"><div class="lbl">A receber em 30 dias</div><div class="val pos">${fmt(rec30)}</div></div>
    <div class="cell"><div class="lbl">A pagar em 30 dias</div><div class="val neg">${fmt(pag30)}</div></div>
    <div class="cell"><div class="lbl">Em atraso</div><div class="val ${late.length ? 'neg' : ''}">${late.length ? fmt(Math.abs(lateSum)) : '—'}</div><div class="note">${late.length ? late.length + (late.length > 1 ? ' itens vencidos e não pagos' : ' item vencido e não pago') : 'nada vencido'}</div></div>
    <div class="cell"><div class="lbl">Saldo em ${S.fRange} dias</div><div class="val ${cls(rw.data[rw.data.length - 1])}">${fmt(rw.data[rw.data.length - 1])}</div></div>
  </div>
  <div class="panel"><div class="panel-h"><h2>Saldo dia a dia</h2><span class="hint">Considera tudo que está pendente, na data de vencimento. Atrasados entram hoje.</span></div>
    <div class="chartbox"><canvas id="cRunway" aria-label="Gráfico do saldo projetado"></canvas></div></div>
  <div class="panel"><div class="panel-h"><h2>Próximas movimentações</h2><span class="hint">Marque como pago quando acontecer; o saldo de hoje é atualizado.</span></div>
    ${rows ? `<div class="ev head"><span>Data</span><span>O quê</span><span style="text-align:right">Valor</span><span class="bal" style="text-align:right">Saldo depois</span><span></span></div>${rows}`
      : `<div class="empty"><h3>Nada pendente neste período</h3><p>Lançamentos com vencimento futuro aparecem aqui.</p></div>`}
  </div>
  <div class="panel"><div class="panel-h"><h2>Mês a mês</h2><span class="hint">Por data de vencimento, pagos e pendentes. Cada mês parte do saldo final do anterior.</span></div>
    <div class="scrollx"><table class="mtab"><thead><tr><th>Mês</th><th>Saldo inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo final</th></tr></thead><tbody>
    ${mt.map(m => `<tr class="${m.ym === nowYM ? 'now' : ''}"><td>${cap(monthName(m.ym))} ${m.ym.slice(0, 4)}</td><td>${fmt(m.open)}</td><td class="pos">${fmt(m.rec)}</td><td class="neg">${fmt(m.des)}</td><td class="${m.close < 0 ? 'neg' : ''}"><b>${fmt(m.close)}</b></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function drawFluxoCharts() {
  const rw = runway(S.fRange);
  const minIdx = rw.data.indexOf(rw.min.v);
  mkChart('cRunway', {
    type: 'line',
    data: {
      labels: rw.labels.map(dm),
      datasets: [{
        data: rw.data, stepped: 'after', borderWidth: 2.4, borderColor: '#0F3D33', tension: 0,
        pointRadius: rw.data.map((_, i) => (i === minIdx ? 5 : 0)), pointBackgroundColor: '#B7770A', pointHoverRadius: 5,
        fill: { target: 'origin', above: 'rgba(23,96,79,.10)', below: 'rgba(196,64,43,.16)' },
        segment: { borderColor: c => (c.p1.parsed.y < 0 ? '#C4402B' : '#0F3D33') }
      }]
    },
    options: baseOpts({ scales: { x: { grid: { display: false }, ticks: { color: '#586861', maxTicksLimit: 8, maxRotation: 0 } }, y: { grid: { color: '#E1E8E4' }, ticks: { color: '#586861', callback: compact } } } })
  });
}

/* ---------------------------- Lançamentos ---------------------------- */
function lancItems() {
  const [from, to] = monthRange(S.month);
  const key = S.lMode === 'data' ? 'data' : 'vencimento';
  const g = groupInfo();
  const q = S.lq.trim().toLowerCase();
  let items = S.tx.filter(r => r[key] >= from && r[key] <= to).map(r => {
    const grp = r.modo === 'parcelada' ? g[r.grupo] : null;
    return { r, grp, valor: (S.lMode === 'data' && grp) ? grp.sum : r.valor, hide: S.lMode === 'data' && grp && grp.first.id !== r.id };
  }).filter(i => !i.hide);
  items = items.filter(i => {
    const r = i.r;
    if (S.lTipo && r.tipo !== S.lTipo) return false;
    if (S.lCat && r.categoria !== S.lCat) return false;
    if (S.lStatus) {
      const pend = (S.lMode === 'data' && i.grp) ? i.grp.paid < i.grp.n : r.status === 'Pendente';
      if (S.lStatus === 'Pendente' ? !pend : pend) return false;
    }
    if (q && (r.descricao + ' ' + r.categoria).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  return { items, key };
}
function lancRow(i) {
  const r = i.r, isGroup = S.lMode === 'data' && i.grp && i.grp.n > 1;
  const meta = [`<span><i class="dot" style="background:${catColor(r.categoria)}"></i>${esc(r.categoria)}</span>`];
  meta.push(`<span>${r.forma === 'Crédito' ? 'Crédito · ' + esc(cardName(r.cartaoId)) : esc(r.forma)}</span>`);
  if (isGroup) meta.push(`<span class="tag info">${i.grp.n}× ${fmt(r.valor)}</span><span>${i.grp.paid} de ${i.grp.n} pagas</span>`);
  else if (r.modo === 'parcelada') meta.push(`<span class="tag info">parcela ${r.parcela}/${r.total}</span>`);
  else if (r.modo === 'recorrente') meta.push(`<span class="tag">mensal ${r.parcela}/${r.total}</span>`);
  if (S.lMode === 'data' && !isGroup && r.vencimento !== r.data) meta.push(`<span>vence ${dm(r.vencimento)}</span>`);
  if (S.lMode === 'venc' && r.data !== r.vencimento && r.modo !== 'recorrente') meta.push(`<span>compra em ${dm(r.data)}</span>`);
  const chk = isGroup
    ? `<button class="check ${i.grp.paid === i.grp.n ? 'on' : ''}" disabled title="Marque cada parcela ou a fatura no cartão">${icon('check', 16)}</button>`
    : `<button class="check ${r.status === 'Pago' ? 'on' : ''}" data-act="toggle" data-id="${r.id}" title="${r.status === 'Pago' ? 'Desmarcar' : (r.tipo === 'Receita' ? 'Marcar como recebido' : 'Marcar como pago')}">${icon('check', 16)}</button>`;
  return `<div class="row" data-act="edit" data-id="${r.id}">${chk}
    <div style="min-width:0"><div class="ttl">${esc(r.descricao)}</div><div class="meta">${meta.join('')}</div></div>
    <div class="amt ${r.tipo === 'Receita' ? 'pos' : ''}">${r.tipo === 'Receita' ? '+' : '−'}${fmt(i.valor)}${isGroup ? `<small>total da compra</small>` : ''}</div></div>`;
}
function lancBodyHTML() {
  const { items, key } = lancItems();
  if (!items.length) {
    return `<div class="panel empty"><h3>Nada em ${monthName(S.month)}</h3><p>${(S.lq || S.lTipo || S.lCat || S.lStatus) ? 'Nenhum lançamento bate com os filtros.' : 'Registre uma receita ou despesa para ver o mês aqui.'}</p><button class="btn primary" data-act="new">Novo lançamento</button></div>`;
  }
  const byDay = {};
  items.forEach(i => { (byDay[i.r[key]] = byDay[i.r[key]] || []).push(i); });
  return `<div class="panel">` + Object.keys(byDay).sort().reverse().map(d => `<div class="day"><h3>${dayLabel(d)}</h3>${byDay[d].map(lancRow).join('')}</div>`).join('') + `</div>`;
}
function lancStripHTML() {
  const { items } = lancItems();
  const rec = r2(sumBy(items.filter(i => i.r.tipo === 'Receita'), i => i.valor));
  const des = r2(sumBy(items.filter(i => i.r.tipo === 'Despesa'), i => i.valor));
  const res = r2(rec - des);
  return `<div class="cell"><div class="lbl">Receitas</div><div class="val pos">${fmt(rec)}</div></div>
    <div class="cell"><div class="lbl">Despesas</div><div class="val neg">${fmt(des)}</div></div>
    <div class="cell"><div class="lbl">Resultado</div><div class="val ${cls(res)}">${fmt(res)}</div><div class="note">${S.lMode === 'data' ? 'Compras parceladas contam inteiras no mês da compra.' : 'Cada parcela conta no mês em que vence.'}</div></div>`;
}
function updateLancList() {
  const a = $('#lancStrip'), b = $('#lancBody');
  if (a) a.innerHTML = lancStripHTML();
  if (b) b.innerHTML = lancBodyHTML();
}
function viewLanc() {
  const catsAll = Array.from(new Set(S.cats.map(c => c.nome).concat(S.tx.map(t => t.categoria)))).sort();
  return `<div class="page-head"><div><h1>Lançamentos</h1><div class="sub">Tudo que você registrou. Toque numa linha para editar.</div></div>
    <div class="controls">${monthNav()}
    <div class="seg" role="group" aria-label="Organizar por"><button class="${S.lMode === 'data' ? 'on' : ''}" data-act="lmode" data-v="data">Por compra</button><button class="${S.lMode === 'venc' ? 'on' : ''}" data-act="lmode" data-v="venc">Por vencimento</button></div></div></div>
  <div class="strip" id="lancStrip">${lancStripHTML()}</div>
  <div class="filters">
    <input type="search" placeholder="Buscar descrição ou categoria" value="${esc(S.lq)}" data-bind="lq" aria-label="Buscar">
    <select data-bind="lTipo" aria-label="Tipo"><option value="">Receitas e despesas</option><option ${S.lTipo === 'Receita' ? 'selected' : ''}>Receita</option><option ${S.lTipo === 'Despesa' ? 'selected' : ''}>Despesa</option></select>
    <select data-bind="lCat" aria-label="Categoria"><option value="">Todas as categorias</option>${catsAll.map(c => `<option ${S.lCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <select data-bind="lStatus" aria-label="Situação"><option value="">Pagas e pendentes</option><option ${S.lStatus === 'Pago' ? 'selected' : ''} value="Pago">Pagas</option><option ${S.lStatus === 'Pendente' ? 'selected' : ''} value="Pendente">Pendentes</option></select>
  </div>
  <div id="lancBody">${lancBodyHTML()}</div>`;
}

/* ---------------------------- Cartões ---------------------------- */
function viewCartoes() {
  const cards = activeCards();
  const head = `<div class="page-head"><div><h1>Cartões</h1><div class="sub">Limite usado e faturas por vencimento.</div></div><div class="controls"><button class="btn primary" data-act="cardnew">${icon('plus', 18)} Novo cartão</button></div></div>`;
  if (!cards.length) {
    return head + `<div class="panel empty"><h3>Nenhum cartão ainda</h3><p>Cadastre o dia de fechamento e de vencimento. O app calcula em qual fatura cada compra cai e distribui as parcelas.</p><button class="btn primary" data-act="cardnew">Cadastrar cartão</button></div>`;
  }
  const t = today();
  const tiles = cards.map(c => {
    const used = r2(sumBy(S.tx.filter(r => r.cartaoId === c.id && r.forma === 'Crédito' && r.status !== 'Pago'), r => r.valor));
    const pct = c.limite > 0 ? Math.min(100, used / c.limite * 100) : 0;
    return `<div class="ctile" style="background:linear-gradient(135deg, ${c.cor || '#17604F'}, #0B2C25 140%)">
      <button class="edit" data-act="cardedit" data-id="${c.id}">Editar</button>
      <h3>${esc(c.nome)}</h3><div class="when">Fecha dia ${c.fechamento} · vence dia ${c.vencimento}</div>
      <div class="lim"><span>Usado</span><b>${fmt(used)}</b></div>
      ${c.limite > 0 ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="lim"><span>Disponível</span><b>${fmt(Math.max(0, c.limite - used))}</b></div>` : `<div class="when" style="margin-top:6px">Sem limite informado</div>`}
    </div>`;
  }).join('');
  const sections = cards.map(c => {
    const fs = faturasOf(c);
    const cutoff = addDays(t, -60);
    const recent = fs.filter(f => !f.paid || f.due >= cutoff);
    const older = fs.filter(f => f.paid && f.due < cutoff).reverse();
    const fatHTML = f => {
      const tag = { Paga: 'good', Vencida: 'bad', Fechada: 'warn', Aberta: 'info' }[f.st];
      const items = f.rows.slice().sort((a, b) => (a.data < b.data ? -1 : 1)).map(r =>
        `<div class="it"><span>${dm(r.data)} · ${esc(r.descricao)}${r.modo === 'parcelada' ? ` <span class="mut">(${r.parcela}/${r.total})</span>` : ''}</span><span>${fmt(r.valor)}</span></div>`).join('');
      const ids = f.rows.map(r => r.id).join(',');
      return `<details class="fat"><summary><span class="t">Vence ${dmy(f.due)}<small>fecha em ${dm(f.closing)} · ${f.rows.length} ${f.rows.length > 1 ? 'lançamentos' : 'lançamento'}</small></span>
        <b>${fmt(f.total)}</b><span class="tag ${tag}">${f.st}</span></summary>
        <div class="items">${items}<div class="foot">${f.paid
          ? `<button class="btn sm" data-act="funpay" data-ids="${ids}">Desfazer pagamento</button>`
          : `<button class="btn sm primary" data-act="fpay" data-ids="${ids}">Marcar fatura como paga</button>`}</div></div></details>`;
    };
    return `<div class="panel"><div class="panel-h"><h2>Faturas · ${esc(c.nome)}</h2><span class="hint">Compras no crédito agrupadas pelo vencimento.</span></div>
      ${recent.length ? recent.map(fatHTML).join('') : '<div class="empty"><p>Nenhuma compra neste cartão ainda. Ao lançar uma despesa, escolha “Crédito”.</p></div>'}
      ${older.length ? `<details style="margin-top:12px"><summary class="btn link" style="display:inline-block;cursor:pointer">Faturas anteriores (${older.length})</summary>${older.map(fatHTML).join('')}</details>` : ''}</div>`;
  }).join('');
  return head + `<div class="cards">${tiles}</div>` + sections;
}

/* ---------------------------- Análise ---------------------------- */
function analysisData() {
  const key = S.aBasis === 'venc' ? 'vencimento' : 'data';
  let cur, prev, label, plabel;
  if (S.aScope === 'mes') {
    cur = monthRange(S.month); prev = monthRange(shiftYM(S.month, -1));
    label = monthLabel(S.month); plabel = monthName(shiftYM(S.month, -1));
  } else {
    const y = Number(S.month.slice(0, 4));
    cur = [`${y}-01-01`, `${y}-12-31`]; prev = [`${y - 1}-01-01`, `${y - 1}-12-31`];
    label = String(y); plabel = String(y - 1);
  }
  const inR = (r, p) => r[key] >= p[0] && r[key] <= p[1];
  return { key, label, plabel, rows: S.tx.filter(r => inR(r, cur)), prows: S.tx.filter(r => inR(r, prev)) };
}
const totals = rows => {
  const rec = r2(sumBy(rows.filter(r => r.tipo === 'Receita'), r => r.valor));
  const des = r2(sumBy(rows.filter(r => r.tipo === 'Despesa'), r => r.valor));
  return { rec, des, res: r2(rec - des), tax: rec > 0 ? (rec - des) / rec : 0 };
};
function deltaTxt(cur, prev, plabel, goodWhenDown) {
  if (!prev) return `<div class="note">sem base em ${plabel}</div>`;
  const p = (cur - prev) / Math.abs(prev) * 100;
  if (Math.abs(p) < 0.5) return `<div class="note">igual a ${plabel}</div>`;
  const good = goodWhenDown === undefined ? null : (goodWhenDown ? p < 0 : p > 0);
  return `<div class="note ${good === null ? '' : good ? 'pos' : 'neg'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}% vs ${plabel}</div>`;
}
function viewAnalise() {
  const A = analysisData(), T = totals(A.rows), P = totals(A.prows);
  const desp = A.rows.filter(r => r.tipo === 'Despesa'), pdesp = A.prows.filter(r => r.tipo === 'Despesa');
  const byCat = {}, pByCat = {};
  desp.forEach(r => { byCat[r.categoria] = (byCat[r.categoria] || 0) + r.valor; });
  pdesp.forEach(r => { pByCat[r.categoria] = (pByCat[r.categoria] || 0) + r.valor; });
  const cats = Object.keys(byCat).map(n => ({ n, v: r2(byCat[n]), p: r2(pByCat[n] || 0) })).sort((a, b) => b.v - a.v);
  const stack = cats.map(c => `<i style="flex:${c.v};background:${catColor(c.n)}" title="${esc(c.n)}: ${fmt(c.v)}"></i>`).join('');
  const legend = cats.map(c => {
    const pc = T.des ? c.v / T.des * 100 : 0;
    let d = '<span class="dl mut">—</span>';
    if (c.p > 0) { const x = (c.v - c.p) / c.p * 100; d = Math.abs(x) < 0.5 ? '<span class="dl mut">igual</span>' : `<span class="dl ${x > 0 ? 'neg' : 'pos'}">${x > 0 ? '▲' : '▼'} ${Math.abs(x).toFixed(0)}%</span>`; }
    return `<div class="li"><span><i class="dot" style="background:${catColor(c.n)}"></i>${esc(c.n)}</span><span><b>${fmt(c.v)}</b></span><span class="mut">${pc.toFixed(0)}%</span>${d}</div>`;
  }).join('');
  const byForma = {};
  desp.forEach(r => { const k = r.forma === 'Crédito' ? 'Crédito · ' + cardName(r.cartaoId) : r.forma; byForma[k] = (byForma[k] || 0) + r.valor; });
  const formas = Object.keys(byForma).map(k => ({ k, v: r2(byForma[k]) })).sort((a, b) => b.v - a.v);
  const fmax = formas.length ? formas[0].v : 1;
  const top = desp.slice().sort((a, b) => b.valor - a.valor).slice(0, 5);

  const t = today();
  const fut = S.tx.filter(r => r.modo === 'parcelada' && r.status !== 'Pago' && r.vencimento > t);
  const futSum = r2(sumBy(fut, r => r.valor));
  const futGroups = new Set(fut.map(r => r.grupo)).size;

  const unit = S.aScope === 'ano' ? 'ano' : 'mes';
  return `<div class="page-head"><div><h1>Análise</h1><div class="sub">Para onde o dinheiro vai e como isso muda ao longo do tempo.</div></div>
    <div class="controls">${monthNav(unit)}
      <div class="seg" role="group" aria-label="Período"><button class="${unit === 'mes' ? 'on' : ''}" data-act="ascope" data-v="mes">Mês</button><button class="${unit === 'ano' ? 'on' : ''}" data-act="ascope" data-v="ano">Ano</button></div>
      <div class="seg" role="group" aria-label="Critério"><button class="${S.aBasis === 'venc' ? 'on' : ''}" data-act="abasis" data-v="venc" title="Conta cada parcela no mês em que ela sai do bolso">Por vencimento</button><button class="${S.aBasis === 'data' ? 'on' : ''}" data-act="abasis" data-v="data" title="Conta a compra inteira no mês em que foi feita">Por compra</button></div></div></div>
  <div class="strip">
    <div class="cell"><div class="lbl">Receitas</div><div class="val pos">${fmt(T.rec)}</div>${deltaTxt(T.rec, P.rec, A.plabel, false)}</div>
    <div class="cell"><div class="lbl">Despesas</div><div class="val neg">${fmt(T.des)}</div>${deltaTxt(T.des, P.des, A.plabel, true)}</div>
    <div class="cell"><div class="lbl">Resultado</div><div class="val ${cls(T.res)}">${fmt(T.res)}</div>${deltaTxt(T.res, P.res, A.plabel, false)}</div>
    <div class="cell"><div class="lbl">Quanto você guardou</div><div class="val ${cls(T.tax)}">${T.rec ? (T.tax * 100).toFixed(0) + '%' : '—'}</div><div class="note">${T.rec ? 'do que recebeu' : 'sem receitas no período'}</div></div>
  </div>
  <div class="panel"><div class="panel-h"><h2>Despesas por categoria · ${A.label}</h2><span class="hint">${cats.length ? 'A variação compara com ' + A.plabel + '.' : ''}</span></div>
    ${cats.length ? `<div class="stackbar">${stack}</div><div class="legend">${legend}</div>` : `<div class="empty"><p>Sem despesas em ${A.label}.</p></div>`}</div>
  <div class="panel"><div class="panel-h"><h2>Receitas e despesas</h2><span class="hint">${unit === 'ano' ? 'Os 12 meses do ano' : 'Os 6 meses até ' + monthName(S.month)}</span></div><div class="chartbox short"><canvas id="cEvo"></canvas></div></div>
  <div class="cols">
    <div class="panel"><div class="panel-h"><h2>Como você pagou</h2></div>
      ${formas.length ? formas.map(f => `<div class="hbar"><span title="${esc(f.k)}">${esc(f.k)}</span><span class="tr"><i style="width:${f.v / fmax * 100}%"></i></span><span>${fmt(f.v)}</span></div>`).join('') : '<div class="empty"><p>Sem despesas no período.</p></div>'}</div>
    <div class="panel"><div class="panel-h"><h2>Maiores gastos</h2></div>
      ${top.length ? top.map(r => `<div class="hbar" style="grid-template-columns:minmax(0,1fr) 96px"><span><i class="dot" style="background:${catColor(r.categoria)}"></i>${esc(r.descricao)} <span class="mut">· ${dm(r[A.key])}</span></span><span>${fmt(r.valor)}</span></div>`).join('') : '<div class="empty"><p>Sem despesas no período.</p></div>'}</div>
  </div>
  <div class="panel"><div class="panel-h"><h2>Parcelas que ainda vão pesar</h2>
    <span class="hint">${fut.length ? `${fmt(futSum)} em ${fut.length} ${fut.length > 1 ? 'parcelas' : 'parcela'} de ${futGroups} ${futGroups > 1 ? 'compras' : 'compra'}` : ''}</span></div>
    ${fut.length ? `<div class="chartbox short"><canvas id="cParc"></canvas></div>` : `<div class="empty"><p>Nenhuma compra parcelada em aberto.</p></div>`}</div>`;
}
function drawAnaliseCharts() {
  const key = S.aBasis === 'venc' ? 'vencimento' : 'data';
  let months = [];
  if (S.aScope === 'ano') { const y = S.month.slice(0, 4); for (let i = 1; i <= 12; i++) months.push(`${y}-${pad(i)}`); }
  else for (let i = 5; i >= 0; i--) months.push(shiftYM(S.month, -i));
  const rec = months.map(m => r2(sumBy(S.tx.filter(r => r.tipo === 'Receita' && r[key].slice(0, 7) === m), r => r.valor)));
  const des = months.map(m => r2(sumBy(S.tx.filter(r => r.tipo === 'Despesa' && r[key].slice(0, 7) === m), r => r.valor)));
  mkChart('cEvo', {
    type: 'bar',
    data: {
      labels: months.map(m => cap(MABR[Number(m.slice(5)) - 1]) + (S.aScope === 'ano' ? '' : '/' + m.slice(2, 4))),
      datasets: [{ label: 'Receitas', data: rec, backgroundColor: '#0E7A5C', borderRadius: 5 }, { label: 'Despesas', data: des, backgroundColor: '#C4402B', borderRadius: 5 }]
    },
    options: baseOpts({ plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, color: '#13211C' } }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) } } } })
  });
  const t = today(), start = shiftYM(t.slice(0, 7), 0), pm = [];
  for (let i = 0; i < 12; i++) pm.push(shiftYM(start, i));
  const pv = pm.map(m => r2(sumBy(S.tx.filter(r => r.modo === 'parcelada' && r.status !== 'Pago' && r.vencimento > t && r.vencimento.slice(0, 7) === m), r => r.valor)));
  mkChart('cParc', {
    type: 'bar',
    data: { labels: pm.map(m => cap(MABR[Number(m.slice(5)) - 1]) + '/' + m.slice(2, 4)), datasets: [{ label: 'Parcelas', data: pv, backgroundColor: '#2F5E8E', borderRadius: 5 }] },
    options: baseOpts()
  });
}

/* =====================================================================
   Gaveta de lançamento (novo e edição)
   ===================================================================== */
function openDrawer() { $('#scrim').hidden = false; $('#drawer').hidden = false; }
function closeDrawer() { $('#scrim').hidden = true; $('#drawer').hidden = true; $('#drawer').innerHTML = ''; }

function formHTML(b, edit, gcount) {
  return `<h2>${edit ? 'Editar lançamento' : 'Novo lançamento'}<button class="icon-btn" type="button" data-act="closeDrawer" aria-label="Fechar">${icon('x')}</button></h2>
  <form id="txForm" novalidate autocomplete="off">
    <div class="seg seg-wide" style="margin-bottom:16px" role="group" aria-label="Tipo">
      <button type="button" data-tipo="Despesa" class="${b.tipo === 'Despesa' ? 'on' : ''}">Despesa</button>
      <button type="button" data-tipo="Receita" class="${b.tipo === 'Receita' ? 'on' : ''}">Receita</button>
    </div>
    <input type="hidden" name="tipo" value="${b.tipo}">
    <label class="field"><span>Valor</span><div class="money"><i>R$</i><input name="valor" inputmode="decimal" placeholder="0,00" value="${b.valor === '' ? '' : String(b.valor).replace('.', ',')}"></div></label>
    <label class="field"><span>Descrição</span><input type="text" name="descricao" placeholder="Ex.: Mercado da semana" value="${esc(b.descricao)}"></label>
    <div class="row2">
      <label class="field"><span>Categoria</span><select name="categoria"></select></label>
      <label class="field"><span>Data</span><input type="date" name="data" value="${b.data}"></label>
    </div>
    <fieldset class="field"><legend>Forma de pagamento</legend><div class="chips" id="formas"></div></fieldset>
    <label class="field" id="cardBox" hidden><span>Cartão</span><select name="cartaoId"></select></label>
    ${edit ? (gcount > 1 ? `<p class="mut" style="margin:0 0 12px">${b.modo === 'parcelada' ? 'Parcela' : 'Lançamento'} ${b.parcela} de ${b.total}.</p>` : '') : `
    <div class="field"><span>Repetição</span>
      <div class="seg seg-wide" id="modoSeg" role="group" aria-label="Repetição"><button type="button" data-modo="unica" class="on">À vista</button><button type="button" data-modo="parcelada">Parcelado</button><button type="button" data-modo="recorrente">Todo mês</button></div></div>
    <input type="hidden" name="modo" value="unica">
    <div id="nBox" class="row2" hidden>
      <label class="field"><span id="nLabel">Parcelas</span><input type="number" name="n" min="2" max="120" value="2" inputmode="numeric"></label>
      <fieldset class="field" id="totalBox"><legend>O valor informado é</legend><div class="chips">
        <label><input type="radio" name="totalMode" value="total" checked><span>O total</span></label>
        <label><input type="radio" name="totalMode" value="parcela"><span>De cada parcela</span></label></div></fieldset>
    </div>`}
    <label class="field"><span id="dueLabel">Vencimento</span><input type="date" name="vencimento" value="${b.vencimento}"></label>
    <label class="ck"><input type="checkbox" name="pago" ${b.status === 'Pago' ? 'checked' : ''}><span id="pagoLabel">Já paguei</span> <small id="pagoHint"></small></label>
    <label class="field"><span>Observação (opcional)</span><input type="text" name="obs" value="${esc(b.obs)}"></label>
    ${edit && gcount > 1 ? `<label class="ck"><input type="checkbox" name="applyGroup"><span>Aplicar descrição, categoria e forma às ${gcount} ocorrências</span></label>` : ''}
    <div class="preview" id="preview"></div>
    <p class="formerr" id="formErr" role="alert"></p>
    <div class="actions">
      ${edit ? `<button type="button" class="btn danger" data-act="delete" data-id="${b.id}">Excluir</button>` : ''}
      ${edit ? '' : `<button type="button" class="btn" data-act="saveMore">Salvar e lançar outro</button>`}
      <button type="submit" class="btn primary">Salvar</button>
    </div>
  </form>`;
}

function openForm(row) {
  const edit = !!row, t0 = today();
  const b = row ? Object.assign({}, row) : { tipo: 'Despesa', descricao: '', valor: '', categoria: '', data: t0, forma: 'Pix', cartaoId: '', vencimento: t0, status: 'Pago', obs: '', modo: 'unica', parcela: 1, total: 1 };
  const grp = edit && row.modo !== 'unica' ? S.tx.filter(x => x.grupo === row.grupo) : [];
  const drawer = $('#drawer');
  drawer.innerHTML = formHTML(b, edit, grp.length);
  openDrawer();
  const form = $('#txForm'), E = form.elements;
  let dueTouched = edit, pagoTouched = edit, chipsTipo = null, wantForma = b.forma;

  function fillCats() {
    const list = S.cats.filter(c => c.tipo === E.tipo.value).map(c => c.nome);
    const cur = E.categoria.value || (b.tipo === E.tipo.value ? b.categoria : '');
    if (cur && list.indexOf(cur) < 0 && cur !== '__new') list.push(cur);
    E.categoria.innerHTML = list.map(n => `<option>${esc(n)}</option>`).join('') + '<option value="__new">+ Nova categoria…</option>';
    E.categoria.value = list.indexOf(cur) > -1 ? cur : (list[0] || '__new');
  }
  function fillFormas() {
    const tipo = E.tipo.value;
    if (chipsTipo === tipo) return;
    chipsTipo = tipo;
    const list = tipo === 'Despesa' ? FORMAS_D : FORMAS_R;
    const pick = list.indexOf(wantForma) > -1 ? wantForma : list[0];
    $('#formas').innerHTML = list.map(f => `<label><input type="radio" name="forma" value="${f}" ${f === pick ? 'checked' : ''}><span>${f}</span></label>`).join('');
  }
  function fillCards() {
    const sel = E.cartaoId;
    const cur = sel.value || b.cartaoId;
    const list = activeCards().slice();
    if (cur && !list.some(c => c.id === cur) && cardById(cur)) list.push(cardById(cur));
    sel.innerHTML = list.length ? list.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('') : '<option value="">Cadastre um cartão em Cartões</option>';
    if (cur && list.some(c => c.id === cur)) sel.value = cur;
  }
  function autoDue() {
    const d = E.data.value || t0;
    if (E.forma.value === 'Crédito') {
      const c = cardById(E.cartaoId.value);
      if (c) return firstDue(d, c);
    }
    return d;
  }
  function currentSchedule() {
    const v = parseMoney(E.valor.value);
    if (!(v > 0) || !E.data.value || !E.vencimento.value) return null;
    return schedule({ valor: v, modo: edit ? 'unica' : E.modo.value, n: edit ? 1 : Number(E.n.value), totalMode: edit ? 'parcela' : E.totalMode.value, data: E.data.value, vencimento: E.vencimento.value });
  }
  function sync() {
    fillCats(); fillFormas();
    const forma = E.forma.value;
    wantForma = forma;
    $('#cardBox').hidden = forma !== 'Crédito';
    if (forma === 'Crédito') fillCards();
    if (!dueTouched) E.vencimento.value = autoDue();
    const modo = edit ? 'unica' : E.modo.value;
    if (!edit) {
      $('#nBox').hidden = modo === 'unica';
      $('#totalBox').hidden = modo !== 'parcelada';
      $('#nLabel').textContent = modo === 'recorrente' ? 'Quantos meses' : 'Parcelas';
      $$('#modoSeg button').forEach(x => x.classList.toggle('on', x.dataset.modo === modo));
    }
    $$('.seg-wide button[data-tipo]').forEach(x => x.classList.toggle('on', x.dataset.tipo === E.tipo.value));
    $('#dueLabel').textContent = forma === 'Crédito' ? 'Vencimento da fatura' : E.tipo.value === 'Receita' ? 'Recebe em' : 'Vencimento';
    $('#pagoLabel').textContent = E.tipo.value === 'Receita' ? 'Já recebi' : forma === 'Crédito' ? 'A fatura já foi paga' : 'Já paguei';
    const due = E.vencimento.value, can = !!due && due <= t0;
    if (!edit) {
      if (!pagoTouched) E.pago.checked = can && forma !== 'Crédito';
      if (!can) E.pago.checked = false;
      E.pago.disabled = !can;
      $('#pagoHint').textContent = can ? '' : 'Fica pendente até o vencimento.';
    }
    // pré-visualização
    let txt = '';
    const sc = currentSchedule();
    if (sc && !edit) {
      const n = sc.length, tot = r2(sumBy(sc, s => s.valor));
      if (forma === 'Crédito' && cardById(E.cartaoId.value)) {
        const c = cardById(E.cartaoId.value);
        txt += `Compra de ${dm(E.data.value)} cai na fatura de ${esc(c.nome)} que fecha em ${dm(closingDateForDue(sc[0].vencimento, c))} e vence em ${dmy(sc[0].vencimento)}. `;
      }
      if (E.modo.value === 'parcelada') txt += `${n}× de ${fmt(sc[0].valor)}${sc[0].valor !== sc[n - 1].valor ? ` (última ${fmt(sc[n - 1].valor)})` : ''} · total ${fmt(tot)} · de ${dmy(sc[0].vencimento)} até ${dmy(sc[n - 1].vencimento)}.`;
      else if (E.modo.value === 'recorrente') txt += `${fmt(sc[0].valor)} por mês, ${n} meses · de ${dmy(sc[0].vencimento)} até ${dmy(sc[n - 1].vencimento)}.`;
    } else if (edit && forma === 'Crédito' && cardById(E.cartaoId.value) && E.vencimento.value) {
      txt = 'Altere o vencimento só se esta parcela caiu em outra fatura.';
    }
    $('#preview').innerHTML = txt;
  }

  // valores iniciais
  E.tipo.value = b.tipo;
  fillCats(); fillFormas();
  if (b.forma === 'Crédito') { $('#cardBox').hidden = false; fillCards(); }
  if (edit) E.cartaoId && fillCards();
  sync();
  if (edit) E.vencimento.value = b.vencimento;
  if (edit && b.status === 'Pago') E.pago.checked = true;
  setTimeout(() => { try { (edit ? E.descricao : E.valor).focus(); } catch (e) { /* ok */ } }, 30);

  form.addEventListener('click', async e => {
    const tb = e.target.closest('button[data-tipo]');
    if (tb) { E.tipo.value = tb.dataset.tipo; chipsTipo = null; E.categoria.value = ''; sync(); return; }
    const mb = e.target.closest('button[data-modo]');
    if (mb) { E.modo.value = mb.dataset.modo; sync(); }
  });
  form.addEventListener('input', e => {
    // A troca de categoria é tratada no 'change'. Rodar sync() aqui desfazia a
    // escolha de "+ Nova categoria…" antes de o 'change' acontecer.
    if (e.target === E.categoria) return;
    if (e.target === E.vencimento) dueTouched = true;
    if (e.target === E.pago) pagoTouched = true;
    sync();
  });
  form.addEventListener('change', async e => {
    if (e.target === E.categoria && E.categoria.value === '__new') {
      const name = await promptBox('Nova categoria', 'Nome da categoria', '');
      if (name && name.trim()) {
        const n = name.trim();
        if (!S.cats.some(c => c.nome === n && c.tipo === E.tipo.value)) {
          const cat = { nome: n, tipo: E.tipo.value, cor: PALETTE[S.cats.length % PALETTE.length] };
          commit(() => S.cats.push(cat), ['saveCats', S.cats.concat([cat])]);
        }
        b.categoria = n; E.categoria.value = '';
        fillCats(); E.categoria.value = n;
      } else { E.categoria.value = ''; fillCats(); }
    }
    sync();
  });

  function fail(msg) { $('#formErr').textContent = msg; }
  function submit(more) {
    $('#formErr').textContent = '';
    const valor = parseMoney(E.valor.value), desc = E.descricao.value.trim();
    if (!(valor > 0)) return fail('Informe um valor maior que zero.');
    if (!desc) return fail('Escreva uma descrição.');
    if (!E.categoria.value || E.categoria.value === '__new') return fail('Escolha uma categoria.');
    if (!E.data.value) return fail('Informe a data.');
    if (!E.vencimento.value) return fail('Informe o vencimento.');
    const forma = E.forma.value, tipo = E.tipo.value;
    if (forma === 'Crédito' && !E.cartaoId.value) return fail('Escolha o cartão. Se ainda não há nenhum, cadastre em Cartões.');
    const cartaoId = forma === 'Crédito' ? E.cartaoId.value : '';

    if (edit) {
      const patch = { id: row.id, descricao: desc, tipo, categoria: E.categoria.value, valor, forma, cartaoId, data: E.data.value, vencimento: E.vencimento.value, status: E.pago.checked ? 'Pago' : 'Pendente', obs: E.obs.value.trim() };
      const patches = [patch];
      if (E.applyGroup && E.applyGroup.checked) {
        grp.forEach(g => { if (g.id !== row.id) patches.push({ id: g.id, descricao: desc, tipo, categoria: patch.categoria, forma, cartaoId }); });
      }
      closeDrawer();
      commit(() => patches.forEach(p => { const r = S.tx.find(x => x.id === p.id); if (r) Object.assign(r, p); }), ['updateTx', patches]);
      toast('Lançamento atualizado');
      return;
    }
    const modo = E.modo.value, n = Number(E.n.value) || 0;
    if (modo !== 'unica' && (n < 2 || n > 120)) return fail('Informe de 2 a 120 ' + (modo === 'parcelada' ? 'parcelas.' : 'meses.'));
    const sc = schedule({ valor, modo, n, totalMode: E.totalMode.value, data: E.data.value, vencimento: E.vencimento.value });
    const grupo = uid(), now = new Date().toISOString(), pago = E.pago.checked;
    const rows = sc.map((s, i) => ({
      id: uid(), data: s.data, descricao: desc, tipo, categoria: E.categoria.value, valor: s.valor, forma, cartaoId,
      modo, parcela: i + 1, total: sc.length, grupo, vencimento: s.vencimento,
      status: (pago && s.vencimento <= t0) ? 'Pago' : 'Pendente', obs: E.obs.value.trim(), criadoEm: now
    }));
    commit(() => { rows.forEach(r => S.tx.push(r)); }, ['addTx', rows]);
    toast(rows.length > 1 ? `${rows.length} lançamentos criados` : 'Lançamento salvo');
    if (more) {
      E.valor.value = ''; E.descricao.value = ''; E.obs.value = ''; pagoTouched = false; sync(); E.valor.focus();
    } else closeDrawer();
  }
  form.addEventListener('submit', e => { e.preventDefault(); submit(false); });
  form._saveMore = () => submit(true);
}

async function deleteRow(r) {
  const grp = r.modo !== 'unica' ? S.tx.filter(x => x.grupo === r.grupo).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1)) : [r];
  let ids;
  if (grp.length <= 1) {
    const ok = await confirmBox('Excluir lançamento?', `${r.descricao} · ${fmt(r.valor)}`, [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: 'one', kind: 'danger solid' }]);
    if (!ok) return;
    ids = [r.id];
  } else {
    const next = grp.filter(x => x.vencimento >= r.vencimento);
    const ch = await confirmBox('Excluir qual parte?', `${r.descricao} tem ${grp.length} ocorrências.`, [
      { label: 'Cancelar', value: null },
      { label: 'Só esta', value: 'one', kind: 'danger' },
      { label: `Esta e as próximas (${next.length})`, value: 'next', kind: 'danger' },
      { label: `Todas (${grp.length})`, value: 'all', kind: 'danger solid' }]);
    if (!ch) return;
    ids = ch === 'one' ? [r.id] : ch === 'next' ? next.map(x => x.id) : grp.map(x => x.id);
  }
  closeDrawer();
  commit(() => { S.tx = S.tx.filter(x => ids.indexOf(x.id) < 0); }, ['deleteTx', ids]);
  toast(ids.length > 1 ? `${ids.length} lançamentos excluídos` : 'Lançamento excluído');
}

function setStatus(ids, status, msg) {
  commit(() => S.tx.forEach(r => { if (ids.indexOf(r.id) > -1) r.status = status; }), ['setStatus', ids, status]);
  if (msg) toast(msg);
}

/* =====================================================================
   Janelas: avisos, cartão e ajustes
   ===================================================================== */
let modalCancel = null;
function showModal(html) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false; }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; modalCancel = null; }
function confirmBox(title, text, buttons) {
  return new Promise(res => {
    showModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions">${buttons.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>`);
    const m = $('#modal');
    const done = v => { m.removeEventListener('click', h); closeModal(); res(v); };
    const h = e => { const b = e.target.closest('button[data-i]'); if (b) done(buttons[Number(b.dataset.i)].value); else if (e.target === m) done(null); };
    m.addEventListener('click', h);
    modalCancel = () => done(null);
  });
}
function promptBox(title, label, initial) {
  return new Promise(res => {
    showModal(`<h2>${esc(title)}</h2><form id="pf"><label class="field"><span>${esc(label)}</span><input type="text" name="v" value="${esc(initial)}"></label><div class="actions"><button type="button" class="btn" data-x="1">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
    const f = $('#pf');
    const done = v => { closeModal(); res(v); };
    setTimeout(() => { try { f.elements.v.focus(); } catch (e) { /* ok */ } }, 20);
    f.addEventListener('submit', e => { e.preventDefault(); done(f.elements.v.value); });
    f.addEventListener('click', e => { if (e.target.closest('[data-x]')) done(null); });
    modalCancel = () => done(null);
  });
}
function cardModal(card) {
  const c = card || { id: '', nome: '', fechamento: 25, vencimento: 5, limite: '', cor: SWATCHES[0], ativo: true };
  const used = card ? S.tx.filter(r => r.cartaoId === card.id).length : 0;
  showModal(`<h2>${card ? 'Editar cartão' : 'Novo cartão'}</h2>
    <form id="cf" novalidate>
      <label class="field"><span>Nome</span><input type="text" name="nome" placeholder="Ex.: Nubank" value="${esc(c.nome)}"></label>
      <div class="row2">
        <label class="field"><span>Dia do fechamento</span><input type="number" name="fechamento" min="1" max="31" value="${c.fechamento}"></label>
        <label class="field"><span>Dia do vencimento</span><input type="number" name="vencimento" min="1" max="31" value="${c.vencimento}"></label>
      </div>
      <label class="field"><span>Limite (opcional)</span><div class="money"><i>R$</i><input name="limite" inputmode="decimal" style="font-size:20px" placeholder="0,00" value="${c.limite ? String(c.limite).replace('.', ',') : ''}"></div></label>
      <fieldset class="field"><legend>Cor</legend><div class="swatches">${SWATCHES.map(s => `<label><input type="radio" name="cor" value="${s}" ${s === c.cor ? 'checked' : ''}><span style="background:${s}"></span></label>`).join('')}</div></fieldset>
      <p class="mut" style="font-size:13px;margin:0 0 12px">Compras feitas até o dia do fechamento entram na fatura que fecha naquele mês.</p>
      <p class="formerr" id="cErr" role="alert"></p>
      <div class="actions">
        ${card ? `<button type="button" class="btn danger" data-x="del">${used ? 'Arquivar' : 'Excluir'}</button>` : ''}
        <button type="button" class="btn" data-x="cancel">Cancelar</button><button class="btn primary">Salvar</button>
      </div>
    </form>`);
  const f = $('#cf');
  modalCancel = closeModal;
  setTimeout(() => { try { f.elements.nome.focus(); } catch (e) { /* ok */ } }, 20);
  f.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]');
    if (!x) return;
    if (x.dataset.x === 'cancel') return closeModal();
    if (x.dataset.x === 'del') {
      const ok = await confirmBox(used ? 'Arquivar cartão?' : 'Excluir cartão?', used ? 'O cartão sai das listas, mas os lançamentos antigos continuam no histórico.' : 'Este cartão não tem lançamentos.', [{ label: 'Cancelar', value: null }, { label: used ? 'Arquivar' : 'Excluir', value: 1, kind: 'danger solid' }]);
      if (!ok) { cardModal(card); return; }
      if (used) { const upd = Object.assign({}, card, { ativo: false }); commit(() => Object.assign(card, upd), ['saveCard', upd]); }
      else commit(() => { S.cards = S.cards.filter(k => k.id !== card.id); }, ['deleteCard', card.id]);
      closeModal();
    }
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const E = f.elements, nome = E.nome.value.trim();
    const fe = Math.floor(Number(E.fechamento.value)), ve = Math.floor(Number(E.vencimento.value));
    const err = m => { $('#cErr').textContent = m; };
    if (!nome) return err('Dê um nome ao cartão.');
    if (!(fe >= 1 && fe <= 31) || !(ve >= 1 && ve <= 31)) return err('Fechamento e vencimento são dias de 1 a 31.');
    const obj = { id: c.id || uid(), nome, fechamento: fe, vencimento: ve, limite: parseMoney(E.limite.value), cor: E.cor.value || SWATCHES[0], ativo: true };
    commit(() => { const i = S.cards.findIndex(k => k.id === obj.id); if (i > -1) S.cards[i] = obj; else S.cards.push(obj); }, ['saveCard', obj]);
    closeModal(); toast(card ? 'Cartão atualizado' : 'Cartão cadastrado');
  });
}
function settingsModal() {
  const cats = S.cats.map(c => Object.assign({}, c));
  const draw = () => ['Despesa', 'Receita'].map(tp => `<fieldset class="field"><legend>Categorias de ${tp === 'Despesa' ? 'despesa' : 'receita'}</legend><div class="catlist">${cats.map((c, i) => c.tipo === tp ? `<span class="tag"><i class="dot" style="background:${c.cor};margin:0"></i>${esc(c.nome)}<button type="button" data-rm="${i}" aria-label="Remover ${esc(c.nome)}">×</button></span>` : '').join('')}</div>
    <div class="catadd"><input type="text" placeholder="Nova categoria" data-new="${tp}" aria-label="Nova categoria de ${tp}"><button type="button" class="btn sm" data-add="${tp}">Adicionar</button></div></fieldset>`).join('');
  showModal(`<h2>Ajustes</h2>
    <form id="sf" novalidate>
      <div class="row2">
        <label class="field"><span>Saldo na data de início</span><div class="money"><i>R$</i><input name="saldo" inputmode="decimal" style="font-size:20px" value="${String(S.cfg.saldoInicial || 0).replace('.', ',')}"></div></label>
        <label class="field"><span>Data de início</span><input type="date" name="inicio" value="${S.cfg.dataInicio || today().slice(0, 4) + '-01-01'}"></label>
      </div>
      <p class="mut" style="font-size:13px;margin:-4px 0 14px">O saldo de hoje = este saldo + tudo que foi pago/recebido a partir da data de início.</p>
      <div id="catArea">${draw()}</div>
      <fieldset class="field"><legend>Dados</legend>
        <p class="mut" style="font-size:13px;margin:0 0 10px">Os lançamentos ficam na planilha Google${S.ssUrl ? ` (<a href="${esc(S.ssUrl)}" target="_blank" rel="noopener">abrir</a>)` : ''}, que ganha uma cópia de segurança por dia no Drive.</p>
        <button type="button" class="btn sm" data-act="export">Baixar cópia (JSON)</button>
        <button type="button" class="btn sm" data-act="conn">Trocar conexão</button></fieldset>
      <div class="actions"><button type="button" class="btn" data-x="cancel">Cancelar</button><button class="btn primary">Salvar ajustes</button></div>
    </form>`);
  const f = $('#sf');
  modalCancel = closeModal;
  const redraw = () => { $('#catArea').innerHTML = draw(); };
  const addCat = tp => {
    const inp = f.querySelector(`[data-new="${tp}"]`), n = inp.value.trim();
    if (!n) return;
    if (!cats.some(c => c.nome === n && c.tipo === tp)) cats.push({ nome: n, tipo: tp, cor: PALETTE[cats.length % PALETTE.length] });
    redraw();
    f.querySelector(`[data-new="${tp}"]`).focus();
  };
  f.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'), ad = e.target.closest('[data-add]');
    if (rm) { cats.splice(Number(rm.dataset.rm), 1); redraw(); }
    else if (ad) addCat(ad.dataset.add);
    else if (e.target.closest('[data-x]')) closeModal();
  });
  f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.new) { e.preventDefault(); addCat(e.target.dataset.new); } });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const cfg = { saldoInicial: parseMoney(f.elements.saldo.value), dataInicio: f.elements.inicio.value || (today().slice(0, 4) + '-01-01') };
    commit(() => { S.cfg = cfg; S.cats = cats; }, [['saveCfg', cfg], ['saveCats', cats]]);
    closeModal(); toast('Ajustes salvos');
  });
}

let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* =====================================================================
   Eventos
   ===================================================================== */
const ACT = {
  nav: t => { S.view = t.dataset.v; render(); window.scrollTo(0, 0); },
  new: () => openForm(),
  edit: t => { const r = S.tx.find(x => x.id === t.dataset.id); if (r) openForm(r); },
  toggle: t => { const r = S.tx.find(x => x.id === t.dataset.id); if (r) setStatus([r.id], r.status === 'Pago' ? 'Pendente' : 'Pago'); },
  mprev: () => { S.month = shiftYM(S.month, S.view === 'analise' && S.aScope === 'ano' ? -12 : -1); render(); },
  mnext: () => { S.month = shiftYM(S.month, S.view === 'analise' && S.aScope === 'ano' ? 12 : 1); render(); },
  lmode: t => { S.lMode = t.dataset.v; render(); },
  frange: t => { S.fRange = Number(t.dataset.v); render(); },
  ascope: t => { S.aScope = t.dataset.v; render(); },
  abasis: t => { S.aBasis = t.dataset.v; render(); },
  evpay: t => setStatus(t.dataset.ids.split(','), 'Pago', 'Marcado como pago'),
  fpay: t => setStatus(t.dataset.ids.split(','), 'Pago', 'Fatura marcada como paga'),
  funpay: t => setStatus(t.dataset.ids.split(','), 'Pendente', 'Pagamento desfeito'),
  cardnew: () => cardModal(),
  cardedit: t => cardModal(cardById(t.dataset.id)),
  settings: () => settingsModal(),
  closeDrawer: () => closeDrawer(),
  saveMore: () => { const f = $('#txForm'); if (f && f._saveMore) f._saveMore(); },
  delete: t => { const r = S.tx.find(x => x.id === t.dataset.id); if (r) deleteRow(r); },
  sync: () => { syncErr = ''; flush().then(() => refresh()); },
  conn: () => { closeModal(); showConnect(); },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
    a.download = 'caixa-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
};
document.addEventListener('click', e => {
  if (e.target.id === 'scrim') return closeDrawer();
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const h = ACT[t.dataset.act];
  if (h) { e.preventDefault(); h(t); }
});
function onBind(e) {
  const k = e.target.dataset && e.target.dataset.bind;
  if (!k) return;
  S[k] = e.target.value;
  updateLancList();
}
document.addEventListener('input', onBind);
document.addEventListener('change', onBind);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) { if (modalCancel) modalCancel(); else closeModal(); }
    else if (!$('#drawer').hidden) closeDrawer();
    return;
  }
  const tag = (e.target.tagName || '').toLowerCase();
  if (String(e.key || '').toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'input' && tag !== 'select' && tag !== 'textarea' && $('#drawer').hidden && $('#modal').hidden) {
    e.preventDefault(); openForm();
  }
});

/* ---------- conexão com a planilha ---------- */
function bootEl() {
  let b = $('#boot');
  if (!b) { b = document.createElement('div'); b.id = 'boot'; b.className = 'boot'; document.body.appendChild(b); }
  b.hidden = false;
  return b;
}
function hideBoot() { const b = $('#boot'); if (b) b.hidden = true; }
function showConnect(msg) {
  const b = bootEl();
  const canCancel = !!conn && !!LS.get('data', null);
  b.innerHTML = `<form class="connect" id="connForm" novalidate autocomplete="off">
    <h1>caixa</h1>
    <p>Conecte este aparelho à planilha onde ficam os seus dados. O endereço e a chave aparecem no registro da função <b>setup</b> do script (veja o README).</p>
    <label class="field"><span>Endereço do app da Web (termina em /exec)</span><input type="text" name="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(conn ? conn.url : '')}"></label>
    <label class="field"><span>Chave de acesso</span><input type="text" name="key" value="${esc(conn ? conn.key : '')}"></label>
    <p class="formerr" id="connErr" role="alert">${esc(msg || '')}</p>
    <div class="actions">${canCancel ? '<button type="button" class="btn" data-x="1">Cancelar</button>' : ''}<button class="btn primary">Conectar</button></div>
  </form>`;
  const f = $('#connForm');
  f.addEventListener('click', e => { if (e.target.closest('[data-x]')) hideBoot(); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const url = f.elements.url.value.trim(), key = f.elements.key.value.trim();
    const err = m => { $('#connErr').textContent = m; };
    if (!/^https:\/\/\S+\/exec$/.test(url)) return err('O endereço deve começar com https:// e terminar em /exec.');
    if (!key) return err('Informe a chave de acesso.');
    const btn = f.querySelector('.primary');
    btn.disabled = true; btn.textContent = 'Conectando…'; err('');
    try {
      const c = { url, key };
      const d = await call('load', [], c);
      conn = c; LS.set('conn', conn); syncErr = '';
      // Alterações ainda não enviadas continuam valendo por cima dos dados recebidos.
      if (!queue.length) { applyData(d); saveLocal(); }
      hideBoot(); render(); flush();
    } catch (x) {
      err(x instanceof AuthError ? 'Chave de acesso incorreta.'
        : x instanceof TypeError ? 'Não consegui falar com o script. Confira o endereço e se a implantação está com acesso para "Qualquer pessoa".'
        : (x.message || String(x)));
      btn.disabled = false; btn.textContent = 'Conectar';
    }
  });
  setTimeout(() => { try { f.elements[conn ? 'key' : 'url'].focus(); } catch (x) { /* ok */ } }, 20);
}

/* =====================================================================
   Início
   ===================================================================== */
window.__caixa = { S, firstDue, closingDateForDue, schedule, splitCents, parseMoney, saldoHoje, pendingEvents, runway, monthlyTable, render, flush, refresh };
window.addEventListener('online', () => flush().then(() => refresh()));
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush().then(() => refresh()); });
setInterval(() => { if (!document.hidden) refresh(); }, 120000);
window.addEventListener('beforeunload', e => { if (queue.length && !LS.get('queue', []).length) { e.preventDefault(); e.returnValue = ''; } });

(async function start() {
  if (!conn) return showConnect();
  const cached = LS.get('data', null);
  if (cached) { applyData(cached); hideBoot(); render(); }
  await flush();
  if (queue.length) { if (!cached) showConnect('Não consegui falar com a planilha.'); return; }
  if (cached) return refresh();
  try {
    applyData(await call('load')); saveLocal(); hideBoot(); render();
  } catch (e) {
    if (e instanceof AuthError) return showConnect(e.message);
    if (!cached) return showConnect('Não consegui abrir os dados: ' + ((e && e.message) || e));
    syncErr = 'Sem conexão com a planilha.'; paintSync();
  }
})();
})();
