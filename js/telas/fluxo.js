/* Caixa — Tela: Fluxo de caixa. */
'use strict';

/* ---------------------------- Fluxo de caixa ---------------------------- */
function viewFluxo() {
  if (!S.tx.length && !S.cards.length && !Number(S.cfg.saldoInicial)) {
    return `<div class="page-head"><div><h1>Fluxo de caixa</h1><div class="sub">Quanto você tem hoje e como o saldo evolui até o fim dos seus compromissos.</div></div></div>
      <div class="panel empty"><h3>Vamos começar</h3>
      <p>Informe o saldo atual das suas contas, cadastre seus cartões e registre o primeiro lançamento.<br>Em seguida este painel mostra o saldo dos próximos dias.</p>
      <button class="btn primary" data-act="settings">Informar saldo inicial</button>
      <button class="btn" data-act="cardnew">Cadastrar cartão</button>
      <button class="btn" data-act="new">Novo lançamento</button>
      <button class="btn" data-act="rulenew">Nova receita ou despesa fixa</button></div>`;
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
  ${rulesPanel()}
  <div class="panel"><div class="panel-h"><h2>Mês a mês</h2><span class="hint">Por data de vencimento, pagos e pendentes. Cada mês parte do saldo final do anterior.</span></div>
    <div class="scrollx"><table class="mtab"><thead><tr><th>Mês</th><th>Saldo inicial</th><th>Entradas</th><th>Saídas</th><th>Saldo final</th></tr></thead><tbody>
    ${mt.map(m => `<tr class="${m.ym === nowYM ? 'now' : ''}"><td>${cap(monthName(m.ym))} ${m.ym.slice(0, 4)}</td><td>${fmt(m.open)}</td><td class="pos">${fmt(m.rec)}</td><td class="neg">${fmt(m.des)}</td><td class="${m.close < 0 ? 'neg' : ''}"><b>${fmt(m.close)}</b></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function rulesPanel() {
  const cur = today().slice(0, 7), t = today();
  const rules = S.rules.slice().sort((a, b) => (a.tipo === b.tipo ? a.descricao.localeCompare(b.descricao) : a.tipo === 'Receita' ? -1 : 1));
  const rows = rules.map(r => {
    const ended = r.fim && r.fim < cur;
    const next = S.tx.filter(x => x.grupo === r.id && x.status !== 'Pago' && x.vencimento >= t).sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1))[0];
    const fim = r.fim ? (ended ? `encerrada em ${monthName(r.fim)}/${r.fim.slice(2, 4)}` : `até ${monthName(r.fim)}/${r.fim.slice(2, 4)}`) : 'sem fim';
    return `<div class="row" data-act="ruleedit" data-id="${r.id}" style="${ended ? 'opacity:.55' : ''}">
      <span class="dot" style="width:12px;height:12px;margin:0 auto;background:${catColor(r.categoria)}"></span>
      <div style="min-width:0"><div class="ttl">${esc(r.descricao)}</div><div class="meta"><span>${esc(r.categoria)}</span><span>${esc(ruleWhen(r))}</span><span>${esc(ruleValueTxt(r))}</span><span class="tag ${ended ? '' : 'info'}">${fim}</span></div></div>
      <div class="amt ${r.tipo === 'Receita' ? 'pos' : ''}">${next ? (r.tipo === 'Receita' ? '+' : '−') + fmt(next.valor) + `<small>próximo ${dm(next.vencimento)}</small>` : '<small>—</small>'}</div></div>`;
  }).join('');
  return `<div class="panel"><div class="panel-h"><h2>Receitas e despesas fixas</h2><button class="btn sm" data-act="rulenew">${icon('plus', 16)} Nova fixa</button></div>
    ${rows || '<div class="empty" style="padding:18px"><p>Salário, benefícios, aluguel, assinaturas: cadastre uma vez e eles entram todo mês sozinhos.</p></div>'}</div>`;
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
