/**
 * Caixa — controle financeiro pessoal.
 * Este script é só o "banco de dados": guarda tudo numa planilha Google e
 * responde ao site (repositório leonardo-pizzi/caixa, publicado no GitHub Pages).
 *
 * Ele é genérico: o site informa em cada pedido quais abas e colunas existem
 * (o "esquema"), e o script cria o que faltar. Assim, novidades no site não
 * exigem mudar este código.
 *
 * Primeira vez: rode a função `setup` uma vez no editor (autoriza, cria as
 * abas, a chave de acesso e o backup diário) e depois publique em
 * Implantar > Nova implantação > App da Web, executando como "Eu" e com acesso
 * para "Qualquer pessoa". O passo a passo está no README.md.
 */

var BACKUP_FOLDER = 'Caixa - backups';
var BACKUP_KEEP = 30; // quantas cópias diárias manter
var API_VERSION = 3;

// Esquema mínimo; o site manda o completo em cada pedido. Colunas em `num` são
// números, em `bool` verdadeiro/falso; o resto é texto (datas em AAAA-MM-DD).
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
  Categorias: { headers: ['nome', 'tipo', 'cor'] },
  Config: { headers: ['chave', 'valor'] },
  Recorrencias: {
    headers: ['id', 'descricao', 'tipo', 'categoria', 'forma', 'cartaoId', 'valor', 'valorModo', 'refMes',
              'diaModo', 'dia', 'sabado', 'inicio', 'fim', 'pulados', 'ajustados', 'valores', 'obs', 'criadoEm'],
    num: ['valor', 'dia'],
    bool: ['sabado']
  }
};

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

var NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;

/** Junta o esquema enviado pelo site ao padrão (só acrescenta abas e colunas). */
function applySchema_(schema) {
  if (!schema || typeof schema !== 'object') return;
  Object.keys(schema).forEach(function (name) {
    var t = schema[name];
    if (!NAME_RE.test(name) || !t || !Array.isArray(t.headers)) return;
    var cur = TABLES[name] || (TABLES[name] = { headers: [], num: [], bool: [] });
    ['headers', 'num', 'bool'].forEach(function (k) {
      cur[k] = cur[k] || [];
      (t[k] || []).forEach(function (h) { if (NAME_RE.test(h) && cur[k].indexOf(h) < 0) cur[k].push(h); });
    });
    if (t.key && NAME_RE.test(t.key)) cur.key = t.key;
  });
}

function table_(name) {
  if (!NAME_RE.test(String(name)) || !TABLES[name] || name === 'Config') reject_('Aba desconhecida: ' + name);
  return name;
}
function rowsArg_(rows) {
  if (!Array.isArray(rows)) reject_('Dados inválidos.');
  return rows.filter(function (r) { return r && typeof r === 'object'; });
}
function key_(name) { return TABLES[name].key || 'id'; }

var ACTIONS = {
  load: function () { return api_load(); },
  // Operações genéricas, para qualquer aba do esquema.
  add: function (t, rows) { return api_add(table_(t), rowsArg_(rows)); },
  update: function (t, patches) { return api_update(table_(t), rowsArg_(patches)); },
  remove: function (t, ids) { return api_remove(table_(t), Array.isArray(ids) ? ids : []); },
  upsert: function (t, row) { return api_upsert(table_(t), rowsArg_([row])[0] || reject_('Dados inválidos.')); },
  replace: function (t, rows) { return api_replace(table_(t), rowsArg_(rows)); },
  saveCfg: function (cfg) { return api_saveCfg(cfg); },
  // Nomes antigos, mantidos para alterações que ainda estejam na fila de algum aparelho.
  addTx: function (rows) { return api_add('Lancamentos', rowsArg_(rows)); },
  updateTx: function (patches) { return api_update('Lancamentos', rowsArg_(patches)); },
  deleteTx: function (ids) { return api_remove('Lancamentos', ids || []); },
  setStatus: function (ids, status) {
    if (status !== 'Pago' && status !== 'Pendente') reject_('Status inválido');
    return api_update('Lancamentos', (ids || []).map(function (id) { return { id: id, status: status }; }));
  },
  saveCard: function (card) { return api_upsert('Cartoes', card); },
  deleteCard: function (id) { return api_remove('Cartoes', [id]); },
  saveCats: function (cats) { return api_replace('Categorias', rowsArg_(cats)); },
  saveRule: function (rule) { return api_upsert('Recorrencias', rule); },
  deleteRule: function (id) { return api_remove('Recorrencias', [id]); }
};

/**
 * Recebe {key, action, args, schema} do site e responde {ok, data} ou {ok: false, error}.
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
      applySchema_(req.schema);
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

var sheets_ = {}; // abas já conferidas nesta execução

function isText_(t, h) {
  return !(t.num && t.num.indexOf(h) > -1) && !(t.bool && t.bool.indexOf(h) > -1);
}

/** Devolve a aba, criando-a ou acrescentando as colunas que faltarem. */
function getSheet_(name) {
  if (sheets_[name]) return sheets_[name];
  var ss = getSS_(), t = TABLES[name];
  var sh = ss.getSheetByName(name), created = false;
  if (!sh) { sh = ss.insertSheet(name); created = true; }
  var have = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  while (have.length && have[have.length - 1] === '') have.pop();
  var missing = t.headers.filter(function (h) { return have.indexOf(h) < 0; });
  if (missing.length) {
    var start = have.length + 1;
    if (sh.getMaxColumns() < start + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
    sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#E2E9E5');
    // Colunas de texto ficam como texto puro: datas não viram data e "=..." não vira fórmula.
    missing.forEach(function (h, i) {
      if (isText_(t, h)) sh.getRange(1, start + i, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    have = have.concat(missing);
  }
  if (created) {
    sh.setFrozenRows(1);
    seed_(name, sh, have);
    var first = ss.getSheetByName('Planilha1') || ss.getSheetByName('Sheet1');
    if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) { try { ss.deleteSheet(first); } catch (e) { /* ignora */ } }
  }
  sheets_[name] = { sh: sh, headers: have };
  return sheets_[name];
}

function seed_(name, sh, headers) {
  var rows = [];
  if (name === 'Categorias') rows = DEFAULT_CATS.map(function (c) { return { nome: c[0], tipo: c[1], cor: c[2] }; });
  else if (name === 'Config') {
    var inicio = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy') + '-01-01';
    rows = [{ chave: 'saldoInicial', valor: '0' }, { chave: 'dataInicio', valor: inicio }];
  }
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(toMatrix_(headers, rows));
}

function readTable_(name) {
  var t = TABLES[name], s = getSheet_(name), sh = s.sh, headers = s.headers;
  var last = sh.getLastRow();
  if (last < 2) return [];
  var tz = Session.getScriptTimeZone();
  var vals = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  vals.forEach(function (row) {
    if (row.every(function (c) { return c === '' || c === null; })) return;
    var o = {};
    headers.forEach(function (h, i) {
      if (!h) return;
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

function toMatrix_(headers, rows) {
  return rows.map(function (r) {
    return headers.map(function (h) { var v = r[h]; return (v === undefined || v === null) ? '' : v; });
  });
}

function ensureRows_(sh, needed) {
  if (sh.getMaxRows() < needed) sh.insertRowsAfter(sh.getMaxRows(), needed - sh.getMaxRows() + 200);
}

function writeTable_(name, rows) {
  var s = getSheet_(name), sh = s.sh, n = s.headers.length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, n).clearContent();
  if (!rows.length) return;
  ensureRows_(sh, rows.length + 1);
  sh.getRange(2, 1, rows.length, n).setValues(toMatrix_(s.headers, rows));
}

function appendRows_(name, rows) {
  if (!rows.length) return;
  var s = getSheet_(name), sh = s.sh;
  var start = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, start + rows.length);
  sh.getRange(start, 1, rows.length, s.headers.length).setValues(toMatrix_(s.headers, rows));
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ API (chamada pelo site) */

function api_load() {
  var cfg = { saldoInicial: 0, dataInicio: '' };
  readTable_('Config').forEach(function (r) {
    if (!r.chave) return;
    cfg[r.chave] = r.chave === 'saldoInicial' ? (Number(String(r.valor).replace(',', '.')) || 0) : r.valor;
  });
  var tables = {};
  Object.keys(TABLES).forEach(function (n) { if (n !== 'Config') tables[n] = readTable_(n); });
  return {
    v: API_VERSION, cfg: cfg, tables: tables,
    // nomes usados pelo site desde a primeira versão
    cards: tables.Cartoes, cats: tables.Categorias, tx: tables.Lancamentos, rules: tables.Recorrencias,
    ssUrl: getSS_().getUrl()
  };
}

/** Acrescenta linhas; as que já existem (mesmo id) são ignoradas, então reenviar não duplica. */
function api_add(name, rows) {
  return withLock_(function () {
    var k = key_(name), seen = {};
    readTable_(name).forEach(function (r) { seen[r[k]] = true; });
    appendRows_(name, rows.filter(function (r) {
      if (!r[k] || seen[r[k]]) return false;
      seen[r[k]] = true; return true;
    }));
    return true;
  });
}

/** patches: [{id, campo: valor, ...}] — só altera os campos enviados. */
function api_update(name, patches) {
  return withLock_(function () {
    var k = key_(name), all = readTable_(name), byId = {};
    patches.forEach(function (p) { byId[p[k]] = p; });
    all.forEach(function (r) {
      var p = byId[r[k]];
      if (!p) return;
      Object.keys(p).forEach(function (f) { if (f !== k && f in r) r[f] = p[f]; });
    });
    writeTable_(name, all);
    return true;
  });
}

function api_remove(name, ids) {
  return withLock_(function () {
    var k = key_(name), drop = {};
    ids.forEach(function (i) { drop[i] = true; });
    writeTable_(name, readTable_(name).filter(function (r) { return !drop[r[k]]; }));
    return true;
  });
}

function api_upsert(name, row) {
  if (!row || !row[key_(name)]) reject_('Dados inválidos.');
  return withLock_(function () {
    var k = key_(name), all = readTable_(name), found = false;
    all = all.map(function (r) { if (r[k] === row[k]) { found = true; return row; } return r; });
    if (!found) all.push(row);
    writeTable_(name, all);
    return true;
  });
}

function api_replace(name, rows) {
  return withLock_(function () { writeTable_(name, rows); return true; });
}

function api_saveCfg(cfg) {
  if (!cfg || typeof cfg !== 'object') reject_('Ajustes inválidos.');
  return withLock_(function () {
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
