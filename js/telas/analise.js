/* Caixa — Tela: Análise. */
'use strict';

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
