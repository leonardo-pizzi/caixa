/* Caixa — Eventos, conexão com a planilha e início. Carregado por último. */
'use strict';

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
  rulenew: () => openRuleForm(),
  ruleedit: t => { const r = S.rules.find(k => k.id === t.dataset.id); if (r) openRuleForm(r); },
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
      if (!queue.length) { applyData(d); saveLocal(); afterServerData(); }
      hideBoot(); render(); flush();
    } catch (x) {
      err(x instanceof AuthError ? 'Chave de acesso incorreta.'
        : x instanceof TypeError ? 'Não consegui falar com o script. Confira o endereço e se a implantação está com acesso para "Qualquer pessoa".'
        : (x.message || String(x)));
      btn.disabled = false; btn.textContent = 'Conectar';
    }
  });
  try { f.elements[conn ? 'key' : 'url'].focus(); } catch (x) { /* ok */ } // cursor no primeiro campo já ao abrir
}

/* =====================================================================
   Início
   ===================================================================== */
window.__caixa = { pending: () => queue.length + (flushing ? 1 : 0), ruleOccurrence, bizDays, holidays, easter, S, firstDue, closingDateForDue, schedule, splitCents, parseMoney, saldoHoje, pendingEvents, runway, monthlyTable, render, flush, refresh };
window.addEventListener('online', () => flush().then(() => refresh()));
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush().then(() => refresh()); });
setInterval(() => { if (!document.hidden) refresh(); }, 120000);
window.addEventListener('beforeunload', e => { if (queue.length && !LS.get('queue', []).length) { e.preventDefault(); e.returnValue = ''; } });

(async function start() {
  if (!conn) return showConnect();
  const cached = LS.get('data', null);
  if (cached) { applyData(cached); hideBoot(); render(); topUpRules(); }
  await flush();
  if (queue.length) { if (!cached) showConnect('Não consegui falar com a planilha.'); return; }
  if (cached) return refresh();
  try {
    applyData(await call('load')); saveLocal(); hideBoot(); render(); afterServerData();
  } catch (e) {
    if (e instanceof AuthError) return showConnect(e.message);
    if (!cached) return showConnect('Não consegui abrir os dados: ' + ((e && e.message) || e));
    syncErr = 'Sem conexão com a planilha.'; paintSync();
  }
})();
