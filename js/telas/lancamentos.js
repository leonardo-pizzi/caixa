/* Caixa — Tela: Lançamentos. */
'use strict';

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
  else if (r.modo === 'recorrente') meta.push(`<span class="tag">${r.total ? `mensal ${r.parcela}/${r.total}` : 'todo mês'}</span>`);
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
