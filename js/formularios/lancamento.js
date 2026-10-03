/* Caixa — Formulário de lançamento (novo e edição). */
'use strict';

/* =====================================================================
   Gaveta de lançamento (novo e edição)
   ===================================================================== */
function openDrawer() { $('#scrim').hidden = false; $('#drawer').hidden = false; }
function closeDrawer() { $('#scrim').hidden = true; $('#drawer').hidden = true; $('#drawer').innerHTML = ''; }

function formHTML(b, edit, gcount, rule) {
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
    ${rule ? `<div class="preview">Este é o mês de ${monthLabel(row_ym(b, rule))} de uma recorrência (${esc(ruleWhen(rule))}, ${esc(ruleValueTxt(rule))}). Mudanças aqui valem só para este mês (ex.: pagar este mês no crédito).
      <div style="margin-top:8px"><button type="button" class="btn sm" data-act="ruleedit" data-id="${rule.id}">Editar a recorrência inteira</button></div></div>` : ''}
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

const row_ym = (r, rule) => r.id.slice(rule.id.length + 1);
function openForm(row) {
  const edit = !!row, t0 = today();
  const b = row ? Object.assign({}, row) : { tipo: 'Despesa', descricao: '', valor: '', categoria: '', data: t0, forma: 'Pix', cartaoId: '', vencimento: t0, status: 'Pago', obs: '', modo: 'unica', parcela: 1, total: 1 };
  const rule = edit && row.modo === 'recorrente' ? S.rules.find(k => k.id === row.grupo) : null;
  const grp = edit && row.modo !== 'unica' && !rule ? S.tx.filter(x => x.grupo === row.grupo) : [];
  const drawer = $('#drawer');
  drawer.innerHTML = formHTML(b, edit, grp.length, rule);
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
  try { (edit ? E.descricao : E.valor).focus(); } catch (e) { /* ok */ } // cursor no primeiro campo já ao abrir

  form.addEventListener('click', async e => {
    const tb = e.target.closest('button[data-tipo]');
    if (tb) { E.tipo.value = tb.dataset.tipo; chipsTipo = null; E.categoria.value = ''; sync(); return; }
    const mb = e.target.closest('button[data-modo]');
    if (mb && mb.dataset.modo === 'recorrente') {
      // "Todo mês" vira uma recorrência: leva o que já foi digitado para o formulário dela.
      const due = E.vencimento.value || E.data.value || t0;
      openRuleForm(null, { tipo: E.tipo.value, valor: parseMoney(E.valor.value) || '', descricao: E.descricao.value.trim(),
        categoria: E.categoria.value === '__new' ? '' : E.categoria.value, forma: E.forma.value, cartaoId: E.cartaoId.value,
        dia: Number(due.slice(8, 10)), obs: E.obs.value.trim() });
      return;
    }
    if (mb) { E.modo.value = mb.dataset.modo; sync(); }
  });
  form.addEventListener('input', e => {
    // A troca de categoria é tratada no 'change'. Rodar sync() aqui desfazia a
    // escolha de "+ Nova categoria…" antes de o 'change' acontecer.
    if (e.target === E.categoria) return;
    if (e.target === E.vencimento) dueTouched = true;
    // Trocou a forma ou o cartão (ex.: este mês foi no crédito): o vencimento passa a ser o da fatura.
    if (edit && (e.target.name === 'forma' || e.target === E.cartaoId)) dueTouched = false;
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
      const ops = [['updateTx', patches]];
      let ruleUpd = null;
      if (rule) {
        // Este mês foi ajustado à mão: a recorrência não mexe mais nele.
        const ym = row_ym(row, rule), aj = adjusted(rule);
        if (aj.indexOf(ym) < 0) { ruleUpd = Object.assign({}, rule, { ajustados: aj.concat([ym]).join(',') }); ops.push(['saveRule', ruleUpd]); }
      }
      commit(() => { patches.forEach(p => { const r = S.tx.find(x => x.id === p.id); if (r) Object.assign(r, p); }); if (ruleUpd) Object.assign(rule, ruleUpd); }, ops);
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
