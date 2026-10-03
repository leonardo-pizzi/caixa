/* Caixa — Regras do negócio: cartão, parcelas, dias úteis, feriados e receitas/despesas fixas. */
'use strict';

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
/* =====================================================================
   Dias úteis, feriados e recorrências
   ===================================================================== */
// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mo, da);
}
const NATIONAL = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']];
const holCache = {};
// Feriados do ano conforme os Ajustes: { 'AAAA-MM-DD': 'nome' }.
function holidays(y) {
  const c = S.cfg, sig = y + '|' + c.feriadosNac + '|' + c.feriadosFac + '|' + c.feriadosExtras;
  if (holCache[sig]) return holCache[sig];
  const out = {};
  if (c.feriadosNac !== '0') {
    NATIONAL.forEach(h => { out[y + '-' + h[0]] = h[1]; });
    out[addDays(easter(y), -2)] = 'Sexta-feira Santa';
  }
  if (c.feriadosFac === '1') {
    const p = easter(y);
    out[addDays(p, -48)] = 'Carnaval'; out[addDays(p, -47)] = 'Carnaval'; out[addDays(p, 60)] = 'Corpus Christi';
  }
  extraHolidays().forEach(h => {
    if (h.d.length === 5) out[y + '-' + h.d] = h.nome || 'Feriado';
    else if (h.d.slice(0, 4) === String(y)) out[h.d] = h.nome || 'Feriado';
  });
  return (holCache[sig] = out);
}
function extraHolidays() {
  try { const v = JSON.parse(S.cfg.feriadosExtras || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function isBizDay(s, sab) {
  const p = parse(s), wd = new Date(p.y, p.m - 1, p.d).getDay();
  if (wd === 0 || (wd === 6 && !sab)) return false;
  return !holidays(p.y)[s];
}
function bizDays(ym, sab) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), out = [];
  for (let d = 1; d <= daysIn(y, m); d++) { const s = iso(y, m, d); if (isBizDay(s, sab)) out.push(s); }
  return out;
}
const monthsBetween = (a, b) => (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)));
// Data e valor de uma recorrência num mês (AAAA-MM).
function ruleOccurrence(rule, ym) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), sab = !!rule.sabado;
  let date;
  if (rule.diaModo === 'fixo') date = iso(y, m, Math.min(Math.max(1, rule.dia || 1), daysIn(y, m)));
  else {
    const bd = bizDays(ym, sab);
    if (!bd.length) date = iso(y, m, daysIn(y, m));
    else date = rule.diaModo === 'ultimo' ? bd[bd.length - 1] : bd[Math.min(Math.max(1, rule.dia || 1), bd.length) - 1];
  }
  const base = valueAt(rule, ym);
  let valor = r2(base), dias = 0;
  if (rule.valorModo === 'diaUtil') {
    dias = bizDays(rule.refMes === 'proximo' ? shiftYM(ym, 1) : ym, sab).length;
    valor = r2(base * dias);
  }
  const card = rule.forma === 'Crédito' ? cardById(rule.cartaoId) : null;
  return { ym, data: date, vencimento: card ? firstDue(date, card) : date, valor, dias };
}
// Histórico de valores: [{desde: 'AAAA-MM', valor}]. Cada mês usa o último valor que já valia.
function valueHist(rule) {
  try { const v = JSON.parse(rule.valores || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function valueAt(rule, ym) {
  let v = Number(rule.valor) || 0;
  const h = valueHist(rule);
  if (h.length) { v = h[0].valor; h.forEach(x => { if (x.desde <= ym) v = x.valor; }); }
  return Number(v) || 0;
}
const adjusted = rule => String(rule.ajustados || '').split(',').filter(Boolean);
const skipped = rule => String(rule.pulados || '').split(',').filter(Boolean);
// Meses que a regra deve ter lançamento: do início até 12 meses à frente (ou até o fim).
function ruleMonths(rule) {
  const last = shiftYM(today().slice(0, 7), 12), end = rule.fim && rule.fim < last ? rule.fim : last, skip = skipped(rule), out = [];
  for (let ym = rule.inicio; ym && ym <= end; ym = shiftYM(ym, 1)) if (skip.indexOf(ym) < 0) out.push(ym);
  return out;
}
function ruleRow(rule, o, status) {
  return { id: rule.id + '-' + o.ym, data: o.data, descricao: rule.descricao, tipo: rule.tipo, categoria: rule.categoria, valor: o.valor,
    forma: rule.forma, cartaoId: rule.forma === 'Crédito' ? rule.cartaoId : '', modo: 'recorrente', parcela: monthsBetween(rule.inicio, o.ym) + 1, total: 0,
    grupo: rule.id, vencimento: o.vencimento, status: status || 'Pendente', obs: rule.obs || '', criadoEm: new Date().toISOString() };
}
// Compara os lançamentos de cada recorrência com o que a regra pede e devolve as alterações.
// update=false só cria os meses que faltam; update=true também ajusta ou apaga os pendentes
// a partir deste mês (depois de editar a regra ou os feriados). Pagos nunca são alterados.
function ruleOps(rules, update, paidUntil) {
  const cur = today().slice(0, 7), adds = [], patches = [], dels = [];
  rules.forEach(rule => {
    const have = {};
    S.tx.forEach(r => { if (r.grupo === rule.id) have[r.id] = r; });
    const want = {};
    ruleMonths(rule).forEach(ym => {
      const o = ruleOccurrence(rule, ym), row = ruleRow(rule, o, paidUntil && o.vencimento <= paidUntil ? 'Pago' : 'Pendente');
      want[row.id] = true;
      const r = have[row.id];
      if (!r) adds.push(row);
      else if (update && r.status !== 'Pago' && ym >= cur && adjusted(rule).indexOf(ym) < 0) {
        const p = { id: r.id }; let ch = false;
        ['data', 'vencimento', 'valor', 'descricao', 'tipo', 'categoria', 'forma', 'cartaoId', 'obs'].forEach(k => { if (r[k] !== row[k]) { p[k] = row[k]; ch = true; } });
        if (ch) patches.push(p);
      }
    });
    if (update) Object.keys(have).forEach(id => { const r = have[id]; if (!want[id] && r.status !== 'Pago' && r.vencimento.slice(0, 7) >= cur) dels.push(id); });
  });
  return { adds, patches, dels };
}
function applyRuleOps(o) {
  if (o.dels.length) S.tx = S.tx.filter(x => o.dels.indexOf(x.id) < 0);
  o.patches.forEach(p => { const r = S.tx.find(x => x.id === p.id); if (r) Object.assign(r, p); });
  o.adds.forEach(r => S.tx.push(r));
}
function ruleOpsList(o) {
  const ops = [];
  if (o.adds.length) ops.push(['addTx', o.adds]);
  if (o.patches.length) ops.push(['updateTx', o.patches]);
  if (o.dels.length) ops.push(['deleteTx', o.dels]);
  return ops;
}
// Cria os meses que faltam (ex.: virou o mês). Roda sempre que os dados chegam.
function topUpRules() {
  if (!S.rules.length) return;
  const o = ruleOps(S.rules.filter(r => !r.fim || r.fim >= r.inicio), false);
  if (o.adds.length) commit(() => applyRuleOps(o), ruleOpsList(o));
}
function ruleWhen(rule) {
  const sab = rule.sabado ? ' (com sábado)' : '';
  if (rule.diaModo === 'fixo') return 'todo dia ' + rule.dia;
  if (rule.diaModo === 'ultimo') return 'último dia útil' + sab;
  return rule.dia + 'º dia útil' + sab;
}
function ruleValueTxt(rule) {
  const v = valueAt(rule, today().slice(0, 7));
  if (rule.valorModo !== 'diaUtil') return fmt(v);
  return fmt(v) + ' por dia útil' + (rule.refMes === 'proximo' ? ' do mês seguinte' : '');
}

function parseMoney(str) {
  let s = String(str || '').replace(/[^\d,.\-]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isNaN(v) ? 0 : r2(v);
}
