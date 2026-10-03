/**
 * Caixa — controle financeiro pessoal.
 * Este script é só o "banco de dados": guarda tudo numa planilha Google (abas
 * Lancamentos, Cartoes, Categorias e Config) e responde ao site publicado no
 * GitHub Pages (pasta caixa/ do repositório).
 *
 * Primeira vez: rode a função `setup` uma vez no editor (autoriza, cria a
 * planilha, a chave de acesso e o backup diário) e depois publique em
 * Implantar > Nova implantação > App da Web, executando como "Eu" e com acesso
 * para "Qualquer pessoa". O passo a passo está em caixa/README.md.
 */

var BACKUP_FOLDER = 'Caixa - backups';
var BACKUP_KEEP = 30; // quantas cópias diárias manter

var TABLES = {
  Lancamentos: {
    headers: ['id', 'data', 'descricao', 'tipo', 'categoria', 'valor', 'forma', 'cartaoId', 'modo',
              'parcela', 'total', 'grupo', 'vencimento', 'status', 'obs', 'criadoEm'],
    num: ['valor', 'parcela', 'total']
  },
  Cartoes: {
    headers: ['id', 'nome', 'fechamento', 'vencimento', 'limite', 'cor', 'ativo'],
    num: ['fechamento', 'vencimento', 'limite'],
    bool: ['ativo']
  },
  Categorias: {
    headers: ['nome', 'tipo', 'cor']
  },
  Config: {
    headers: ['chave', 'valor']
  },
  // Regras de lançamentos que se repetem todo mês (salário, benefícios, contas fixas).
  Recorrencias: {
    headers: ['id', 'descricao', 'tipo', 'categoria', 'forma', 'cartaoId', 'valor', 'valorModo', 'refMes',
              'diaModo', 'dia', 'sabado', 'inicio', 'fim', 'pulados', 'ajustados', 'valores', 'obs', 'criadoEm'],
    num: ['valor', 'dia'],
    bool: ['sabado']
  }
};

var API_VERSION = 2;

var DEFAULT_CATS = [
  ['Moradia', 'Despesa', '#17604F'], ['Mercado', 'Despesa', '#5E7A2E'], ['Alimentação', 'Despesa', '#C26A2B'],
  ['Transporte', 'Despesa', '#2F5E8E'], ['Saúde', 'Despesa', '#9A3B5C'], ['Educação', 'Despesa', '#6C4A9E'],
  ['Lazer', 'Despesa', '#0E7A8C'], ['Assinaturas', 'Despesa', '#44546A'], ['Compras', 'Despesa', '#B7770A'],
  ['Dívidas', 'Despesa', '#C4402B'], ['Impostos e taxas', 'Despesa', '#8C6D1F'], ['Pets', 'Despesa', '#3E8E7E'],
  ['Investimentos', 'Despesa', '#0F3D33'], ['Outros', 'Despesa', '#6B7280'],
  ['Salário', 'Receita', '#0E7A5C'], ['Freelance', 'Receita', '#2F8F6B'],
  ['Rendimentos', 'Receita', '#3E8E7E'], ['Outras receitas', 'Receita', '#5E7A2E']
];

/* ------------------------------------------------------------------ web app */

/** Rode uma vez no editor: autoriza o script, cria a planilha, a chave e o backup diário. */
function setup() {
  var ss = getSS_();
  Object.keys(TABLES).forEach(function (n) { getSheet_(n); });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_KEY')) props.setProperty('API_KEY', Utilities.getUuid());
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'backupDiario'; });
  if (!has) ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Planilha de dados: ' + ss.getUrl());
  Logger.log('Chave de acesso (cole no site): ' + props.getProperty('API_KEY'));
}

/** Mostra a chave de acesso de novo no registro de execução. */
function mostrarChave() {
  Logger.log('Chave de acesso: ' + PropertiesService.getScriptProperties().getProperty('API_KEY'));
}

/** Gera uma chave nova; os aparelhos conectados vão pedir a chave nova. */
function trocarChave() {
  PropertiesService.getScriptProperties().setProperty('API_KEY', Utilities.getUuid());
  mostrarChave();
}

/** Abrir o endereço /exec no navegador só confirma que o script está no ar. */
function doGet() {
  return json_({ ok: true, app: 'caixa' });
}

var ACTIONS = {
  load: function () { return api_load(); },
  addTx: function (rows) { return api_addTx(rows); },
  updateTx: function (patches) { return api_updateTx(patches); },
  deleteTx: function (ids) { return api_deleteTx(ids); },
  setStatus: function (ids, status) { return api_setStatus(ids, status); },
  saveCard: function (card) { return api_saveCard(card); },
  deleteCard: function (id) { return api_deleteCard(id); },
  saveCats: function (cats) { return api_saveCats(cats); },
  saveCfg: function (cfg) { return api_saveCfg(cfg); },
  saveRule: function (rule) { return api_saveRule(rule); },
  deleteRule: function (id) { return api_deleteRule(id); }
};

/**
 * Recebe {key, action, args} do site e responde {ok, data} ou {ok: false, error}.
 * `rejected` marca dados inválidos (o site descarta a alteração); qualquer outra
 * falha o site tenta de novo mais tarde, sem perder nada.
 */
function doPost(e) {
  var out;
  try {
    var req;
    try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (pe) { reject_('Pedido inválido.'); }
    var key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || req.key !== key) {
      out = { ok: false, auth: true, error: key ? 'Chave de acesso inválida.' : 'Rode a função setup no editor do script.' };
    } else {
      var fn = ACTIONS[req.action];
      if (!fn) reject_('Ação desconhecida: ' + req.action);
      out = { ok: true, data: fn.apply(null, Array.isArray(req.args) ? req.args : []) };
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err), rejected: !!(err && err.rejected) };
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function reject_(msg) {
  var e = new Error(msg);
  e.rejected = true;
  throw e;
}

/** Roda todo dia (gatilho criado pelo setup): copia a planilha para a pasta de backups. */
function backupDiario() {
  var ss = getSS_();
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  DriveApp.getFileById(ss.getId()).makeCopy('Caixa - backup ' + stamp, folder);
  var files = [], fi = folder.getFiles();
  while (fi.hasNext()) files.push(fi.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
}

/* ------------------------------------------------------------------ planilha */

var ss_ = null; // planilha já aberta nesta execução

function getSS_() {
  if (ss_) return ss_;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_ID');
  if (id) {
    // Se a planilha salva não abrir (sem permissão, falha temporária), NÃO cria outra:
    // isso trocaria a planilha de dados por uma vazia e os lançamentos "sumiriam".
    try { ss_ = SpreadsheetApp.openById(id); } catch (e) {
      throw new Error('Não consegui abrir a planilha de dados (' + id + '). ' +
        'Confira se a implantação executa como "Eu" e se a planilha não foi excluída. Detalhe: ' + e.message);
    }
    return ss_;
  }
  try { ss_ = SpreadsheetApp.getActiveSpreadsheet(); } catch (e2) { ss_ = null; }
  if (!ss_) ss_ = SpreadsheetApp.create('Caixa - dados');
  props.setProperty('DB_ID', ss_.getId());
  return ss_;
}

function getSheet_(name) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  var t = TABLES[name];
  sh = ss.insertSheet(name);
  var n = t.headers.length;
  sh.getRange(1, 1, 1, n).setValues([t.headers]).setFontWeight('bold').setBackground('#E2E9E5');
  sh.setFrozenRows(1);
  // Tudo que não é número fica como texto puro: datas em AAAA-MM-DD e nenhum "=..." vira fórmula.
  t.headers.forEach(function (h, i) {
    var isNum = t.num && t.num.indexOf(h) > -1;
    var isBool = t.bool && t.bool.indexOf(h) > -1;
    if (!isNum && !isBool) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  seed_(name, sh);
  var first = ss.getSheetByName('Planilha1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1) { try { ss.deleteSheet(first); } catch (e) { /* ignora */ } }
  return sh;
}

function seed_(name, sh) {
  if (name === 'Categorias') {
    sh.getRange(2, 1, DEFAULT_CATS.length, 3).setValues(DEFAULT_CATS);
  } else if (name === 'Config') {
    var tz = Session.getScriptTimeZone();
    var inicio = Utilities.formatDate(new Date(), tz, 'yyyy') + '-01-01';
    sh.getRange(2, 1, 2, 2).setValues([['saldoInicial', '0'], ['dataInicio', inicio]]);
  }
}

function readTable_(name) {
  var t = TABLES[name];
  var sh = getSheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var tz = Session.getScriptTimeZone();
  var vals = sh.getRange(2, 1, last - 1, t.headers.length).getValues();
  var out = [];
  vals.forEach(function (row) {
    var empty = row.every(function (c) { return c === '' || c === null; });
    if (empty) return;
    var o = {};
    t.headers.forEach(function (h, i) {
      var v = row[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      if (t.num && t.num.indexOf(h) > -1) o[h] = Number(v) || 0;
      else if (t.bool && t.bool.indexOf(h) > -1) o[h] = (v === true || String(v).toUpperCase() === 'TRUE');
      else o[h] = (v === null || v === undefined) ? '' : String(v);
    });
    out.push(o);
  });
  return out;
}

function toMatrix_(name, rows) {
  var t = TABLES[name];
  return rows.map(function (r) {
    return t.headers.map(function (h) { return (r[h] === undefined || r[h] === null) ? '' : r[h]; });
  });
}

function ensureRows_(sh, needed) {
  if (sh.getMaxRows() < needed) sh.insertRowsAfter(sh.getMaxRows(), needed - sh.getMaxRows() + 200);
}

function writeTable_(name, rows) {
  var t = TABLES[name];
  var sh = getSheet_(name);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, t.headers.length).clearContent();
  if (!rows.length) return;
  ensureRows_(sh, rows.length + 1);
  sh.getRange(2, 1, rows.length, t.headers.length).setValues(toMatrix_(name, rows));
}

function appendRows_(name, rows) {
  if (!rows.length) return;
  var t = TABLES[name];
  var sh = getSheet_(name);
  var start = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, start + rows.length);
  sh.getRange(start, 1, rows.length, t.headers.length).setValues(toMatrix_(name, rows));
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ API (chamada pelo navegador) */

function api_load() {
  var cfgRows = readTable_('Config');
  var cfg = { saldoInicial: 0, dataInicio: '' };
  cfgRows.forEach(function (r) {
    if (!r.chave) return;
    cfg[r.chave] = r.chave === 'saldoInicial' ? (Number(String(r.valor).replace(',', '.')) || 0) : r.valor;
  });
  return {
    v: API_VERSION,
    cfg: cfg,
    cards: readTable_('Cartoes'),
    cats: readTable_('Categorias'),
    tx: readTable_('Lancamentos'),
    rules: readTable_('Recorrencias'),
    ssUrl: getSS_().getUrl()
  };
}

function api_addTx(rows) {
  if (!Array.isArray(rows)) reject_('Lançamentos inválidos.');
  return withLock_(function () {
    // Se o envio for repetido (resposta perdida na rede), não duplica.
    var seen = {};
    readTable_('Lancamentos').forEach(function (r) { seen[r.id] = true; });
    appendRows_('Lancamentos', rows.filter(function (r) { return r && r.id && !seen[r.id]; }));
    return true;
  });
}

/** patches: [{id, campo: valor, ...}] — só altera os campos enviados. */
function api_updateTx(patches) {
  return withLock_(function () {
    var all = readTable_('Lancamentos');
    var byId = {};
    patches.forEach(function (p) { byId[p.id] = p; });
    all.forEach(function (r) {
      var p = byId[r.id];
      if (!p) return;
      Object.keys(p).forEach(function (k) { if (k !== 'id' && k in r) r[k] = p[k]; });
    });
    writeTable_('Lancamentos', all);
    return true;
  });
}

function api_deleteTx(ids) {
  return withLock_(function () {
    var drop = {};
    ids.forEach(function (i) { drop[i] = true; });
    var keep = readTable_('Lancamentos').filter(function (r) { return !drop[r.id]; });
    writeTable_('Lancamentos', keep);
    return true;
  });
}

function api_setStatus(ids, status) {
  if (status !== 'Pago' && status !== 'Pendente') reject_('Status inválido');
  return withLock_(function () {
    var mark = {};
    ids.forEach(function (i) { mark[i] = true; });
    var all = readTable_('Lancamentos');
    all.forEach(function (r) { if (mark[r.id]) r.status = status; });
    writeTable_('Lancamentos', all);
    return true;
  });
}

function api_saveCard(card) {
  return withLock_(function () {
    var all = readTable_('Cartoes');
    var found = false;
    all = all.map(function (c) {
      if (c.id === card.id) { found = true; return card; }
      return c;
    });
    if (!found) all.push(card);
    writeTable_('Cartoes', all);
    return true;
  });
}

function api_deleteCard(id) {
  return withLock_(function () {
    writeTable_('Cartoes', readTable_('Cartoes').filter(function (c) { return c.id !== id; }));
    return true;
  });
}

function api_saveCats(cats) {
  return withLock_(function () {
    writeTable_('Categorias', cats);
    return true;
  });
}

function api_saveCfg(cfg) {
  return withLock_(function () {
    if (!cfg || typeof cfg !== 'object') reject_('Ajustes inválidos.');
    // Guarda todas as chaves enviadas (saldo, data de início, feriados…), sempre como texto.
    var rows = Object.keys(cfg).map(function (k) {
      var v = cfg[k];
      if (k === 'saldoInicial') v = Number(v) || 0;
      return { chave: k, valor: (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v === undefined || v === null ? '' : v) };
    });
    writeTable_('Config', rows);
    return true;
  });
}

function api_saveRule(rule) {
  if (!rule || !rule.id) reject_('Recorrência inválida.');
  return withLock_(function () {
    var all = readTable_('Recorrencias'), found = false;
    all = all.map(function (r) { if (r.id === rule.id) { found = true; return rule; } return r; });
    if (!found) all.push(rule);
    writeTable_('Recorrencias', all);
    return true;
  });
}

function api_deleteRule(id) {
  return withLock_(function () {
    writeTable_('Recorrencias', readTable_('Recorrencias').filter(function (r) { return r.id !== id; }));
    return true;
  });
}
