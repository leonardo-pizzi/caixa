/* Caixa — Cálculos usados pelas telas: saldo, fluxo e análises. */
'use strict';

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
