/* Caixa — Utilidades gerais e datas (texto AAAA-MM-DD, sem fuso). */
'use strict';

/* =====================================================================
   Utilidades
   ===================================================================== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fmt = v => { v = r2(v); if (Object.is(v, -0) || v === 0) v = 0; return BRL.format(v); };
const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const FORMAS_D = ['Crédito', 'Débito', 'Pix', 'Dinheiro', 'Boleto'];
const FORMAS_R = ['Pix', 'Transferência', 'Dinheiro', 'Outro'];
const SWATCHES = ['#17604F', '#2F5E8E', '#6C4A9E', '#9A3B5C', '#C4402B', '#C26A2B', '#B7770A', '#44546A'];
const PALETTE = ['#17604F', '#C4402B', '#2F5E8E', '#B7770A', '#6C4A9E', '#0E7A8C', '#9A3B5C', '#5E7A2E', '#C26A2B', '#44546A', '#8C6D1F', '#3E8E7E'];

const IC = {
  flow: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  chart: '<path d="M5 20V11M11 20V4M17 20v-6M3 20h18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const icon = (n, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* =====================================================================
   Datas (sempre texto AAAA-MM-DD, sem fuso horário)
   ===================================================================== */
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = s => { const p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const today = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const dmy = s => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const dm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
function addMonths(s, n, anchorDay) {
  const p = parse(s);
  const t = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  return iso(y, m, Math.min(anchorDay || p.d, daysIn(y, m)));
}
function addDays(s, n) {
  const p = parse(s);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const shiftYM = (ym, n) => { const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
const monthRange = ym => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return [iso(y, m, 1), iso(y, m, daysIn(y, m))]; };
const monthName = ym => MESES[Number(ym.slice(5, 7)) - 1];
const monthLabel = ym => `${cap(monthName(ym))} de ${ym.slice(0, 4)}`;
function dayLabel(s) {
  const p = parse(s);
  const dt = new Date(p.y, p.m - 1, p.d);
  const wd = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dt.getDay()];
  return `${cap(wd)}, ${p.d} de ${MESES[p.m - 1]}`;
}
