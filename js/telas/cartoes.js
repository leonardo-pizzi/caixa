/* Caixa — Tela: Cartões. */
'use strict';

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
