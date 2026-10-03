/* Caixa — Formulário de receita/despesa fixa e exclusões. */
'use strict';

/* =====================================================================
   Recorrências (todo mês, com ou sem fim)
   ===================================================================== */
function monthOptions(sel, from, n) {
  let h = '';
  for (let i = 0; i < n; i++) { const ym = shiftYM(from, i); h += `<option value="${ym}" ${ym === sel ? 'selected' : ''}>${monthLabel(ym)}</option>`; }
  return h;
}
function openRuleForm(rule, pre) {
  const edit = !!rule, t0 = today(), cur = t0.slice(0, 7);
  pre = pre || {};
  const b = rule ? Object.assign({}, rule, { valor: valueAt(rule, cur < rule.inicio ? rule.inicio : cur) }) : {
    id: '', tipo: pre.tipo || 'Despesa', descricao: pre.descricao || '', categoria: pre.categoria || '', forma: pre.forma || 'Pix', cartaoId: pre.cartaoId || '',
    valor: pre.valor || '', valorModo: 'fixo', refMes: 'mesmo', diaModo: 'fixo', dia: pre.dia || Number(t0.slice(8, 10)), sabado: false,
    inicio: cur, fim: '', pulados: '', obs: pre.obs || ''
  };
  const chips = (name, opts, val) => `<div class="chips">${opts.map(o => `<label><input type="radio" name="${name}" value="${o[0]}" ${o[0] === val ? 'checked' : ''}><span>${o[1]}</span></label>`).join('')}</div>`;
  const startFrom = shiftYM(b.inicio < cur ? b.inicio : cur, -12);
  $('#drawer').innerHTML = `<h2>${edit ? 'Editar fixa' : 'Nova receita ou despesa fixa'}<button class="icon-btn" type="button" data-act="closeDrawer" aria-label="Fechar">${icon('x')}</button></h2>
  <form id="ruleForm" novalidate autocomplete="off">
    <p class="mut" style="margin:-6px 0 14px;font-size:13.5px">Um lançamento por mês, criado sozinho. Sem data de fim, ele continua até você encerrar.</p>
    <div class="seg seg-wide" style="margin-bottom:16px" role="group" aria-label="Tipo">
      <button type="button" data-tipo="Despesa" class="${b.tipo === 'Despesa' ? 'on' : ''}">Despesa</button>
      <button type="button" data-tipo="Receita" class="${b.tipo === 'Receita' ? 'on' : ''}">Receita</button>
    </div>
    <input type="hidden" name="tipo" value="${b.tipo}">
    <fieldset class="field"><legend>Valor</legend>${chips('valorModo', [['fixo', 'Fixo todo mês'], ['diaUtil', 'Por dia útil']], b.valorModo)}</fieldset>
    <label class="field"><span id="valLabel">Valor</span><div class="money"><i>R$</i><input name="valor" inputmode="decimal" placeholder="0,00" value="${b.valor === '' ? '' : String(b.valor).replace('.', ',')}"></div></label>
    ${edit ? `<label class="field" id="desdeBox" hidden><span>O novo valor vale a partir de</span><select name="desde">${monthOptions(cur < b.inicio ? b.inicio : cur, cur < b.inicio ? b.inicio : cur, 25)}</select></label>` : ''}
    <fieldset class="field" id="refBox"><legend>Contar os dias úteis de</legend>${chips('refMes', [['mesmo', 'O próprio mês'], ['proximo', 'O mês seguinte']], b.refMes)}</fieldset>
    <label class="field"><span>Descrição</span><input type="text" name="descricao" placeholder="Ex.: Salário" value="${esc(b.descricao)}"></label>
    <label class="field"><span>Categoria</span><select name="categoria"></select></label>
    <fieldset class="field"><legend>Forma de pagamento</legend><div class="chips" id="rFormas"></div></fieldset>
    <label class="field" id="rCardBox" hidden><span>Cartão</span><select name="cartaoId"></select></label>
    <fieldset class="field"><legend id="whenLabel">Quando cai</legend>${chips('diaModo', [['fixo', 'Dia fixo'], ['util', 'Nº dia útil'], ['ultimo', 'Último dia útil']], b.diaModo)}</fieldset>
    <label class="field" id="diaBox"><span id="diaLabel">Dia do mês</span><input type="number" name="dia" min="1" max="31" value="${b.dia || 1}" inputmode="numeric"></label>
    <label class="ck" id="sabBox"><input type="checkbox" name="sabado" ${b.sabado ? 'checked' : ''}><span>Sábado conta como dia útil</span></label>
    <div class="row2">
      <label class="field"><span>Começa em</span><select name="inicio">${monthOptions(b.inicio, startFrom, 48)}</select></label>
      <label class="field"><span>Termina</span><select name="fim"><option value="">Sem data de fim</option>${monthOptions(b.fim, startFrom, 84)}</select></label>
    </div>
    ${edit ? '' : `<label class="ck"><input type="checkbox" name="pago"><span id="rPagoLabel">Já recebi os meses que já passaram</span></label>`}
    <label class="field"><span>Observação (opcional)</span><input type="text" name="obs" value="${esc(b.obs)}"></label>
    <div class="preview" id="rPreview"></div>
    <p class="formerr" id="rErr" role="alert"></p>
    <div class="actions">
      ${edit ? `<button type="button" class="btn danger" data-x="del">Excluir</button><button type="button" class="btn" data-x="end">Encerrar</button>` : ''}
      <button type="submit" class="btn primary">Salvar</button>
    </div>
  </form>`;
  openDrawer();
  const f = $('#ruleForm'), E = f.elements;
  let formasTipo = null, wantForma = b.forma;
  function fillCats() {
    const list = S.cats.filter(c => c.tipo === E.tipo.value).map(c => c.nome);
    const curC = E.categoria.value || (b.tipo === E.tipo.value ? b.categoria : '');
    if (curC && curC !== '__new' && list.indexOf(curC) < 0) list.push(curC);
    E.categoria.innerHTML = list.map(n => `<option>${esc(n)}</option>`).join('') + '<option value="__new">+ Nova categoria…</option>';
    E.categoria.value = list.indexOf(curC) > -1 ? curC : (list[0] || '__new');
  }
  function fillFormas() {
    if (formasTipo === E.tipo.value) return;
    formasTipo = E.tipo.value;
    const list = formasTipo === 'Despesa' ? FORMAS_D : FORMAS_R, pick = list.indexOf(wantForma) > -1 ? wantForma : list[0];
    $('#rFormas').innerHTML = list.map(x => `<label><input type="radio" name="forma" value="${x}" ${x === pick ? 'checked' : ''}><span>${x}</span></label>`).join('');
  }
  function fillCards() {
    const sel = E.cartaoId, c0 = sel.value || b.cartaoId, list = activeCards().slice();
    if (c0 && !list.some(c => c.id === c0) && cardById(c0)) list.push(cardById(c0));
    sel.innerHTML = list.length ? list.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('') : '<option value="">Cadastre um cartão em Cartões</option>';
    if (c0 && list.some(c => c.id === c0)) sel.value = c0;
  }
  function read() {
    // Parte da fixa existente: campos que esta tela não conhece continuam lá.
    return Object.assign({}, rule || {}, {
      id: b.id || uid(), descricao: E.descricao.value.trim(), tipo: E.tipo.value, categoria: E.categoria.value,
      forma: E.forma.value, cartaoId: E.forma.value === 'Crédito' ? E.cartaoId.value : '',
      valor: parseMoney(E.valor.value), valorModo: E.valorModo.value, refMes: E.refMes.value,
      diaModo: E.diaModo.value, dia: Math.floor(Number(E.dia.value)) || 0, sabado: E.sabado.checked,
      inicio: E.inicio.value, fim: E.fim.value, pulados: b.pulados || '', ajustados: b.ajustados || '', valores: b.valores || '', obs: E.obs.value.trim(), criadoEm: b.criadoEm || new Date().toISOString()
    });
  }
  function sync() {
    fillCats(); fillFormas();
    $$('#ruleForm button[data-tipo]').forEach(x => x.classList.toggle('on', x.dataset.tipo === E.tipo.value));
    const forma = E.forma.value, porDia = E.valorModo.value === 'diaUtil', dm = E.diaModo.value;
    wantForma = forma;
    $('#rCardBox').hidden = forma !== 'Crédito';
    if (forma === 'Crédito') fillCards();
    $('#valLabel').textContent = porDia ? 'Valor por dia útil' : 'Valor por mês';
    $('#refBox').hidden = !porDia;
    if (edit) $('#desdeBox').hidden = parseMoney(E.valor.value) === r2(b.valor);
    $('#diaBox').hidden = dm === 'ultimo';
    $('#diaLabel').textContent = dm === 'util' ? 'Qual dia útil (ex.: 5 para o 5º dia útil)' : 'Dia do mês';
    E.dia.max = dm === 'util' ? 23 : 31;
    $('#sabBox').hidden = dm === 'fixo' && !porDia;
    $('#whenLabel').textContent = E.tipo.value === 'Receita' ? 'Quando cai na conta' : (forma === 'Crédito' ? 'Dia da cobrança no cartão' : 'Quando vence');
    if (E.pago) $('#rPagoLabel').textContent = E.tipo.value === 'Receita' ? 'Já recebi os meses que já passaram' : 'Já paguei os meses que já passaram';
    // prévia dos próximos meses
    const r = read();
    if (!(r.valor > 0) || !r.inicio || (r.diaModo !== 'ultimo' && !(r.dia >= 1))) { $('#rPreview').innerHTML = ''; return; }
    const months = ruleMonths(Object.assign({}, r, { pulados: '' })).filter(ym => ym >= (r.inicio > cur ? r.inicio : cur)).slice(0, 4);
    if (!months.length) { $('#rPreview').innerHTML = r.fim && r.fim < r.inicio ? '' : 'Nenhum mês a partir de agora.'; return; }
    const lines = months.map(ym => {
      const o = ruleOccurrence(r, ym);
      return `<div>${dmy(o.vencimento)} · <b>${fmt(o.valor)}</b>${r.valorModo === 'diaUtil' ? ` <span class="mut">(${o.dias} dias úteis de ${monthName(r.refMes === 'proximo' ? shiftYM(ym, 1) : ym)})</span>` : ''}</div>`;
    }).join('');
    $('#rPreview').innerHTML = `<b>Próximos:</b>${lines}<div class="mut" style="margin-top:4px">${r.fim ? 'Último mês: ' + monthName(r.fim) + ' de ' + r.fim.slice(0, 4) + '.' : 'Sem data de fim.'}</div>`;
  }
  sync();
  try { (edit ? E.descricao : E.valor).focus(); } catch (e) { /* ok */ } // cursor no primeiro campo já ao abrir

  f.addEventListener('click', async e => {
    const tb = e.target.closest('button[data-tipo]');
    if (tb) { E.tipo.value = tb.dataset.tipo; formasTipo = null; E.categoria.value = ''; sync(); return; }
    const x = e.target.closest('[data-x]');
    if (!x) return;
    if (x.dataset.x === 'end') {
      E.fim.value = cur; sync();
      $('#rErr').textContent = '';
      $('#rPreview').insertAdjacentHTML('afterbegin', `<div style="margin-bottom:6px"><b>Encerrando:</b> ${monthLabel(cur)} fica como último mês. Os meses seguintes que ainda não foram pagos serão apagados. Confira e clique em Salvar.</div>`);
      return;
    }
    if (x.dataset.x === 'del') {
      const rows = S.tx.filter(t => t.grupo === rule.id), pagos = rows.filter(t => t.status === 'Pago');
      const ch = await confirmBox('Excluir esta fixa?', pagos.length
        ? `Você pode apagar só o que está pendente e manter no histórico os ${pagos.length} meses já pagos, ou apagar tudo.`
        : 'Os lançamentos desta recorrência serão apagados.',
        pagos.length ? [{ label: 'Cancelar', value: null }, { label: 'Manter os pagos', value: 'keep', kind: 'danger' }, { label: 'Apagar tudo', value: 'all', kind: 'danger solid' }]
          : [{ label: 'Cancelar', value: null }, { label: 'Excluir', value: 'all', kind: 'danger solid' }]);
      if (!ch) return;
      const ids = rows.filter(t => ch === 'all' || t.status !== 'Pago').map(t => t.id);
      closeDrawer();
      commit(() => { S.rules = S.rules.filter(k => k.id !== rule.id); S.tx = S.tx.filter(t => ids.indexOf(t.id) < 0); },
        ids.length ? [['deleteRule', rule.id], ['deleteTx', ids]] : ['deleteRule', rule.id]);
      toast('Fixa excluída');
    }
  });
  f.addEventListener('input', e => { if (e.target !== E.categoria) sync(); });
  f.addEventListener('change', async e => {
    if (e.target === E.categoria && E.categoria.value === '__new') {
      const name = await promptBox('Nova categoria', 'Nome da categoria', '');
      const n = (name || '').trim();
      if (n) {
        if (!S.cats.some(c => c.nome === n && c.tipo === E.tipo.value)) {
          const cat = { nome: n, tipo: E.tipo.value, cor: PALETTE[S.cats.length % PALETTE.length] };
          commit(() => S.cats.push(cat), ['saveCats', S.cats.concat([cat])]);
        }
        b.categoria = n; b.tipo = E.tipo.value; E.categoria.value = '';
      } else E.categoria.value = '';
    }
    sync();
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const err = m => { $('#rErr').textContent = m; };
    if (S.serverV < 2) return err('Atualize o script da planilha para usar recorrências (veja o README, passo "Atualizar o script").');
    const r = read();
    if (!(r.valor > 0)) return err('Informe um valor maior que zero.');
    if (!r.descricao) return err('Escreva uma descrição.');
    if (!r.categoria || r.categoria === '__new') return err('Escolha uma categoria.');
    if (r.forma === 'Crédito' && !r.cartaoId) return err('Escolha o cartão.');
    if (r.diaModo === 'fixo' && !(r.dia >= 1 && r.dia <= 31)) return err('O dia do mês vai de 1 a 31.');
    if (r.diaModo === 'util' && !(r.dia >= 1 && r.dia <= 23)) return err('O dia útil vai de 1 a 23.');
    if (r.fim && r.fim < r.inicio) return err('O mês de término não pode ser antes do início.');
    if (r.diaModo === 'ultimo') r.dia = 0;
    if (r.valorModo !== 'diaUtil') r.refMes = 'mesmo';
    if (r.diaModo === 'fixo' && r.valorModo !== 'diaUtil') r.sabado = false;
    if (edit && r.valor !== r2(b.valor)) {
      // Valor novo só a partir do mês escolhido; os anteriores ficam com o valor antigo.
      const desde = E.desde.value, h = valueHist(rule).filter(x => x.desde < desde);
      if (!h.length) h.push({ desde: rule.inicio, valor: Number(rule.valor) || 0 });
      h.push({ desde, valor: r.valor });
      r.valores = JSON.stringify(h);
    }
    const o = ruleOps([r], true, !edit && E.pago.checked ? t0 : '');
    closeDrawer();
    commit(() => {
      const i = S.rules.findIndex(k => k.id === r.id);
      if (i > -1) S.rules[i] = r; else S.rules.push(r);
      applyRuleOps(o);
    }, [['saveRule', r]].concat(ruleOpsList(o)));
    toast(edit ? 'Fixa atualizada' : `Fixa criada · ${o.adds.length} ${o.adds.length > 1 ? 'meses lançados' : 'mês lançado'}`);
  });
}

async function deleteRow(r) {
  const rule = r.modo === 'recorrente' && S.rules.find(k => k.id === r.grupo);
  if (rule) {
    const ym = r.id.slice(rule.id.length + 1);
    const ch = await confirmBox('Excluir qual parte?', `${r.descricao} se repete todo mês.`, [
      { label: 'Cancelar', value: null },
      { label: 'Só este mês', value: 'one', kind: 'danger' },
      { label: 'Este e os próximos (encerrar)', value: 'next', kind: 'danger solid' }]);
    if (!ch) return;
    const upd = Object.assign({}, rule);
    if (ch === 'one') upd.pulados = skipped(rule).concat([ym]).join(',');
    else upd.fim = shiftYM(ym, -1);
    const ids = ch === 'one' ? [r.id] : S.tx.filter(t => t.grupo === rule.id && t.status !== 'Pago' && t.id.slice(rule.id.length + 1) >= ym).map(t => t.id).concat(r.status === 'Pago' ? [r.id] : []);
    closeDrawer();
    commit(() => { Object.assign(rule, upd); S.tx = S.tx.filter(x => ids.indexOf(x.id) < 0); }, [['saveRule', upd], ['deleteTx', ids]]);
    toast(ch === 'one' ? 'Mês excluído' : 'Fixa encerrada');
    return;
  }
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
