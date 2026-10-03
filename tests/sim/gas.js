// Simula os serviços do Google Apps Script o suficiente para rodar o script/Code.gs
// de verdade, sem Google: planilha em memória, propriedades, trava, Drive e gatilhos.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const CODE = path.join(__dirname, '..', '..', 'script', 'Code.gs');
// codePath: outro Code.gs (ex.: versão antiga); ss/props: reaproveita uma planilha existente.
function makeGAS(codePath, ss0, props0) {
  const props = props0 || {};
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr: nr || 1, nc: nc || 1 }); }
    setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { const R = this.r + i - 1; while (this.sh.d.length <= R) this.sh.d.push([]); this.sh.d[R][this.c + j - 1] = x; })); return this; }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const R = this.sh.d[this.r + i - 1]; const v = R ? R[this.c + j - 1] : undefined; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
    clearContent() { for (let i = 0; i < this.nr; i++) { const R = this.sh.d[this.r + i - 1]; if (R) for (let j = 0; j < this.nc; j++) R[this.c + j - 1] = ''; } return this; }
    setFontWeight() { return this; } setBackground() { return this; } setNumberFormat() { return this; }
    clearContents() { return this.clearContent(); }
  }
  class Sheet {
    constructor(n) { this.n = n; this.d = []; this.max = 1000; }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
    getLastRow() { for (let i = this.d.length - 1; i >= 0; i--) if (this.d[i] && this.d[i].some(x => x !== '' && x !== undefined)) return i + 1; return 0; }
    getLastColumn() { let m = 0; this.d.forEach(r => { if (r) for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== undefined) { m = Math.max(m, j + 1); break; } }); return m; }
    getMaxColumns() { return this.maxc || 26; } insertColumnsAfter(a, n) { this.maxc = (this.maxc || 26) + n; }
    getMaxRows() { return this.max; } insertRowsAfter(a, n) { this.max += n; } setFrozenRows() {}
    clearContents() { this.d = []; return this; }
  }
  const ss = ss0 || { sheets: [new Sheet('Planilha1')],
    getSheetByName(n) { return this.sheets.find(s => s.n === n) || null; },
    insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
    getSheets() { return this.sheets; }, deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); },
    getId() { return 'SSID'; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/SSID'; } };
  const ctx = {
    SpreadsheetApp: { openById: id => { if (ctx.__failOpen) throw new Error('sem acesso'); return ss; }, getActiveSpreadsheet: () => null, create: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
    Utilities: { formatDate: (d, tz, f) => f === 'yyyy' ? String(d.getFullYear()) : d.toISOString().slice(0, 10), getUuid: () => 'chave-teste-123',
      DigestAlgorithm: { MD5: 'md5' }, computeDigest: (a, s) => Array.from(crypto.createHash('md5').update(s).digest()), base64Encode: b => Buffer.from(b).toString('base64') },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
    Logger: { log: () => {} },
    DriveApp: { copies: [], getFoldersByName: () => ({ hasNext: () => false }), createFolder: n => ({ n, getFiles: () => ({ hasNext: () => false }) }),
      getFileById: id => ({ makeCopy: (nome) => { ctx.DriveApp.copies.push(nome); } }) },
    __ss: ss, __props: props
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath || CODE, 'utf8'), ctx);
  return ctx;
}
// Atalho: chama o doPost como o site faz.
function post(G, action, args, schema) {
  return JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ key: 'chave-teste-123', action, args, schema }) } }).t);
}
module.exports = { makeGAS, post };
