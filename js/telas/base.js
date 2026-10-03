/* Caixa — Gráficos, menu lateral e desenho da tela atual. */
'use strict';

/* =====================================================================
   Gráficos
   ===================================================================== */
let charts = [];
function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) { /* ok */ } }); charts = []; }
function mkChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  charts.push(new Chart(el, cfg));
}
const compact = v => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(v));
function baseOpts(extra) {
  return Object.assign({
    maintainAspectRatio: false, responsive: true,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + (c.dataset.label ? c.dataset.label + ': ' : '') + fmt(c.parsed.y) } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#586861', maxRotation: 0 } },
      y: { grid: { color: '#E1E8E4' }, ticks: { color: '#586861', callback: compact } }
    }
  }, extra || {});
}

/* =====================================================================
   Telas
   ===================================================================== */
function renderRail() {
  const items = [['fluxo', 'flow', 'Fluxo de caixa'], ['lanc', 'list', 'Lançamentos'], ['cartoes', 'card', 'Cartões'], ['analise', 'chart', 'Análise']];
  $('#rail').innerHTML =
    `<div class="brand">caixa<small>suas contas, em dia</small></div>` +
    `<button class="newbtn" data-act="new">${icon('plus')}<span>Novo lançamento</span></button>` +
    items.map(i => `<button class="nav-item ${S.view === i[0] ? 'on' : ''}" data-act="nav" data-v="${i[0]}">${icon(i[1])}<span class="lb">${i[2]}</span></button>`).join('') +
    `<div class="spacer"></div><button id="sync" class="sync" data-act="sync" type="button"></button>` +
    `<button class="nav-item" data-act="settings">${icon('gear')}<span class="lb">Ajustes</span></button>`;
  paintSync();
}
function render() {
  renderRail();
  destroyCharts();
  const fn = { fluxo: viewFluxo, lanc: viewLanc, cartoes: viewCartoes, analise: viewAnalise }[S.view];
  $('#view').innerHTML = fn();
  if (S.view === 'fluxo') drawFluxoCharts();
  if (S.view === 'analise') drawAnaliseCharts();
}
function monthNav(unit) {
  const label = unit === 'ano' ? S.month.slice(0, 4) : monthLabel(S.month);
  return `<div class="monthnav"><button class="icon-btn" data-act="mprev" aria-label="Anterior">${icon('left')}</button><b>${label}</b><button class="icon-btn" data-act="mnext" aria-label="Próximo">${icon('right')}</button></div>`;
}
const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
