/* Caixa — Janelas: avisos, cartão e ajustes. */
'use strict';

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
    try { f.elements.v.focus(); } catch (e) { /* ok */ } // cursor no primeiro campo já ao abrir
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
  try { f.elements.nome.focus(); } catch (e) { /* ok */ } // cursor no primeiro campo já ao abrir
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
    // Parte do cartão existente: campos que esta tela não conhece continuam lá.
    const obj = Object.assign({}, card || {}, { id: c.id || uid(), nome, fechamento: fe, vencimento: ve, limite: parseMoney(E.limite.value), cor: E.cor.value || SWATCHES[0], ativo: true });
    commit(() => { const i = S.cards.findIndex(k => k.id === obj.id); if (i > -1) S.cards[i] = obj; else S.cards.push(obj); }, ['saveCard', obj]);
    closeModal(); toast(card ? 'Cartão atualizado' : 'Cartão cadastrado');
  });
}
function settingsModal() {
  const cats = S.cats.map(c => Object.assign({}, c));
  const extras = extraHolidays().map(h => Object.assign({}, h));
  const hDate = d => (d.length === 5 ? d.slice(3, 5) + '/' + d.slice(0, 2) + ' (todo ano)' : dmy(d));
  const drawHol = () => `<div class="catlist">${extras.map((h, i) => `<span class="tag">${esc(hDate(h.d))} · ${esc(h.nome || 'Feriado')}<button type="button" data-hrm="${i}" aria-label="Remover">×</button></span>`).join('') || '<span class="mut" style="font-size:13px">Nenhum feriado da cidade cadastrado.</span>'}</div>`;
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
      <fieldset class="field"><legend>Feriados (para contar dias úteis)</legend>
        <label class="ck" style="margin-bottom:6px"><input type="checkbox" name="fNac" ${S.cfg.feriadosNac !== '0' ? 'checked' : ''}><span>Feriados nacionais <small>(inclui Sexta-feira Santa)</small></span></label>
        <label class="ck"><input type="checkbox" name="fFac" ${S.cfg.feriadosFac === '1' ? 'checked' : ''}><span>Carnaval e Corpus Christi também</span></label>
        <div id="holArea">${drawHol()}</div>
        <div class="catadd"><input type="text" name="hData" placeholder="DD/MM ou DD/MM/AAAA" style="flex:0 0 150px" aria-label="Data do feriado"><input type="text" name="hNome" placeholder="Nome (ex.: Aniversário da cidade)" aria-label="Nome do feriado"><button type="button" class="btn sm" data-hadd="1">Adicionar</button></div>
        <p class="mut" style="font-size:13px;margin:-6px 0 0">DD/MM repete todo ano; com o ano, vale só naquela data.</p>
        <p class="formerr" id="hErr"></p>
      </fieldset>
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
  const addHol = () => {
    const E = f.elements, v = E.hData.value.trim(), m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    $('#hErr').textContent = '';
    if (!m) { $('#hErr').textContent = 'Use DD/MM ou DD/MM/AAAA.'; return; }
    const d = Number(m[1]), mo = Number(m[2]), y = m[3] ? Number(m[3]) : 2000;
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo))) { $('#hErr').textContent = 'Data inválida.'; return; }
    const key = m[3] ? iso(y, mo, d) : pad(mo) + '-' + pad(d);
    if (!extras.some(h => h.d === key)) extras.push({ d: key, nome: E.hNome.value.trim() || 'Feriado' });
    extras.sort((a, b) => (a.d.slice(-5) < b.d.slice(-5) ? -1 : 1));
    E.hData.value = ''; E.hNome.value = '';
    $('#holArea').innerHTML = drawHol(); E.hData.focus();
  };
  f.addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'), ad = e.target.closest('[data-add]');
    const hr = e.target.closest('[data-hrm]');
    if (hr) { extras.splice(Number(hr.dataset.hrm), 1); $('#holArea').innerHTML = drawHol(); return; }
    if (e.target.closest('[data-hadd]')) return addHol();
    if (rm) { cats.splice(Number(rm.dataset.rm), 1); redraw(); }
    else if (ad) addCat(ad.dataset.add);
    else if (e.target.closest('[data-x]')) closeModal();
  });
  f.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.dataset.new) { e.preventDefault(); addCat(e.target.dataset.new); }
    else if (e.target.name === 'hData' || e.target.name === 'hNome') { e.preventDefault(); addHol(); }
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const cfg = Object.assign({}, S.cfg, {
      saldoInicial: parseMoney(f.elements.saldo.value), dataInicio: f.elements.inicio.value || (today().slice(0, 4) + '-01-01'),
      feriadosNac: f.elements.fNac.checked ? '1' : '0', feriadosFac: f.elements.fFac.checked ? '1' : '0', feriadosExtras: JSON.stringify(extras)
    });
    const holChanged = ['feriadosNac', 'feriadosFac', 'feriadosExtras'].some(k => String(S.cfg[k] || '') !== cfg[k]) &&
      !(S.cfg.feriadosNac === undefined && cfg.feriadosNac === '1' && cfg.feriadosFac === '0' && cfg.feriadosExtras === '[]');
    const ops = [['saveCfg', cfg], ['saveCats', cats]];
    let o = null;
    if (holChanged && S.rules.length) {
      // Feriados mudaram: recalcula datas e valores dos meses pendentes das recorrências.
      const old = S.cfg; S.cfg = cfg;
      o = ruleOps(S.rules, true);
      S.cfg = old;
      ruleOpsList(o).forEach(x => ops.push(x));
    }
    commit(() => { S.cfg = cfg; S.cats = cats; if (o) applyRuleOps(o); }, ops);
    closeModal(); toast(o && (o.patches.length || o.adds.length || o.dels.length) ? 'Ajustes salvos · recorrências recalculadas' : 'Ajustes salvos');
  });
}

let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
