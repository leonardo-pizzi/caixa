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
var API_VERSION = 4;

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
  Categorias: { headers: ['nome', 'tipo', 'cor'], key: ['nome', 'tipo'] },
  Config: { headers: ['chave', 'valor'], key: 'chave' },
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

/**
 * Junta um esquema ao atual. Só ACRESCENTA abas, colunas e tipos: nada é
 * removido nem renomeado, para nenhum dado se perder. Devolve true se mudou.
 */
function applySchema_(schema) {
  var changed = false;
  if (!schema || typeof schema !== 'object') return false;
  Object.keys(schema).forEach(function (name) {
    var t = schema[name];
    if (!NAME_RE.test(name) || !t || !Array.isArray(t.headers)) return;
    if (!TABLES[name]) { TABLES[name] = { headers: [], num: [], bool: [] }; changed = true; }
    var cur = TABLES[name];
    ['headers', 'num', 'bool'].forEach(function (k) {
      cur[k] = cur[k] || [];
      (t[k] || []).forEach(function (h) { if (NAME_RE.test(h) && cur[k].indexOf(h) < 0) { cur[k].push(h); changed = true; } });
    });
    var key = Array.isArray(t.key) ? t.key.filter(function (h) { return NAME_RE.test(h); }) : (NAME_RE.test(t.key || '') ? t.key : null);
    if (key && (Array.isArray(key) ? key.length : true) && JSON.stringify(cur.key) !== JSON.stringify(key)) { cur.key = key; changed = true; }
  });
  return changed;
}

/** O esquema acumulado fica salvo no script, para valer mesmo em pedidos sem esquema. */
function loadSchema_() {
  try { applySchema_(JSON.parse(PropertiesService.getScriptProperties().getProperty('SCHEMA') || '{}')); } catch (e) { /* ignora */ }
}
function saveSchema_() {
  PropertiesService.getScriptProperties().setProperty('SCHEMA', JSON.stringify(TABLES));
}

/**
 * Aba _Dicionario: descreve cada aba e coluna (tipo, chave e significado), para que
 * qualquer programa futuro entenda e reaproveite os dados sem depender deste site.
 * Reescrita só quando o esquema ou as descrições mudam.
 */
function updateDictionary_(schema) {
  var docs = {};
  Object.keys(schema || {}).forEach(function (n) {
    var t = schema[n];
    if (NAME_RE.test(n) && t && (t.desc || t.fields)) docs[n] = { desc: String(t.desc || ''), fields: t.fields || {} };
  });
  var props = PropertiesService.getScriptProperties();
  var sig = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify([docs, TABLES])));
  if (props.getProperty('DICT_SIG') === sig) return;
  var ss = getSS_(), sh = ss.getSheetByName('_Dicionario') || ss.insertSheet('_Dicionario');
  var rows = [['aba', 'campo', 'tipo', 'chave', 'descricao']];
  Object.keys(TABLES).forEach(function (n) {
    var t = TABLES[n], d = docs[n] || { desc: '', fields: {} }, key = t.key || 'id';
    rows.push([n, '', 'aba', '', d.desc]);
    t.headers.forEach(function (h) {
      var tipo = t.num && t.num.indexOf(h) > -1 ? 'número' : t.bool && t.bool.indexOf(h) > -1 ? 'sim/não' : 'texto';
      var isKey = Array.isArray(key) ? key.indexOf(h) > -1 : key === h;
      rows.push([n, h, tipo, isKey ? 'sim' : '', String((d.fields || {})[h] || '')]);
    });
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 5).setNumberFormat('@').setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#E2E9E5');
  sh.setFrozenRows(1);
  props.setProperty('DICT_SIG', sig);
}

/** Campos que chegam sem coluna ganham uma (tipo pelo valor), em vez de serem descartados. */
function ensureFields_(name, rows) {
  var t = TABLES[name], add = { headers: [], num: [], bool: [] };
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (h) {
      if (!NAME_RE.test(h) || t.headers.indexOf(h) > -1 || add.headers.indexOf(h) > -1) return;
      add.headers.push(h);
      if (typeof r[h] === 'number') add.num.push(h);
      else if (typeof r[h] === 'boolean') add.bool.push(h);
    });
  });
  if (!add.headers.length) return;
  var one = {}; one[name] = add;
  applySchema_(one);
  delete sheets_[name];
  saveSchema_();
}

function table_(name) {
  if (!NAME_RE.test(String(name)) || !TABLES[name] || name === 'Config') reject_('Aba desconhecida: ' + name);
  return name;
}
function rowsArg_(rows) {
  if (!Array.isArray(rows)) reject_('Dados inválidos.');
  return rows.filter(function (r) { return r && typeof r === 'object'; });
}
/** Identificação de uma linha: a coluna-chave (padrão "id") ou várias juntas, como nome + tipo. */
function rowKey_(name, r) {
  var k = TABLES[name].key || 'id';
  if (!Array.isArray(k)) return r[k] === undefined || r[k] === null ? '' : String(r[k]);
  return k.map(function (h) { return r[h] === undefined || r[h] === null ? '' : String(r[h]); }).join('|');
}

var ACTIONS = {
  load: function () { return api_load(); },
  // Operações genéricas, para qualquer aba do esquema.
  add: function (t, rows) { return api_add(table_(t), rowsArg_(rows)); },
  update: function (t, patches) { return api_update(table_(t), rowsArg_(patches)); },
  remove: function (t, ids) { return api_remove(table_(t), Array.isArray(ids) ? ids : []); },
  upsert: function (t, row) { return api_upsert(table_(t), rowsArg_([row])[0] || reject_('Dados inválidos.')); },
  replace: function (t, rows) { return api_replace(table_(t), rowsArg_(rows)); },
  saveCfg: function (cfg) { return api_saveCfg(cfg); },
  backup: function (motivo) { return api_backup(String(motivo || '')); },
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
      loadSchema_();
      if (applySchema_(req.schema)) saveSchema_();
      if (req.action === 'load' && req.schema) { try { updateDictionary_(req.schema); } catch (de) { /* o dicionário nunca impede o uso */ } }
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
  copia_('Caixa - backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
}

/** Cópia pedida pelo site, por exemplo antes de uma migração de dados. */
function api_backup(motivo) {
  var nome = 'Caixa - backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
    (motivo ? ' (' + motivo.slice(0, 60) + ')' : '');
  copia_(nome);
  return nome;
}

function copia_(nome) {
  var ss = getSS_();
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
  DriveApp.getFileById(ss.getId()).makeCopy(nome, folder);
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
    v: API_VERSION, cfg: cfg, tables: tables, schema: TABLES,
    // nomes usados pelo site desde a primeira versão
    cards: tables.Cartoes, cats: tables.Categorias, tx: tables.Lancamentos, rules: tables.Recorrencias,
    ssUrl: getSS_().getUrl()
  };
}

/** Acrescenta linhas; as que já existem (mesmo id) são ignoradas, então reenviar não duplica. */
function api_add(name, rows) {
  return withLock_(function () {
    ensureFields_(name, rows);
    var seen = {};
    readTable_(name).forEach(function (r) { seen[rowKey_(name, r)] = true; });
    appendRows_(name, rows.filter(function (r) {
      var id = rowKey_(name, r);
      if (!id || seen[id]) return false;
      seen[id] = true; return true;
    }));
    return true;
  });
}

/** patches: [{id, campo: valor, ...}] — só altera os campos enviados. */
function api_update(name, patches) {
  return withLock_(function () {
    ensureFields_(name, patches);
    var all = readTable_(name), byId = {};
    patches.forEach(function (p) { byId[rowKey_(name, p)] = p; });
    all.forEach(function (r) {
      var p = byId[rowKey_(name, r)];
      if (!p) return;
      Object.keys(p).forEach(function (f) { r[f] = p[f]; });
    });
    writeTable_(name, all);
    return true;
  });
}

function api_remove(name, ids) {
  return withLock_(function () {
    var drop = {};
    ids.forEach(function (i) { drop[String(i)] = true; });
    writeTable_(name, readTable_(name).filter(function (r) { return !drop[rowKey_(name, r)]; }));
    return true;
  });
}

function api_upsert(name, row) {
  if (!row || !rowKey_(name, row).replace(/\|/g, '')) reject_('Dados inválidos.');
  return withLock_(function () {
    ensureFields_(name, [row]);
    var id = rowKey_(name, row), all = readTable_(name), found = false;
    // Mescla com o que já existe: campos que o site não mandou continuam lá.
    all = all.map(function (r) { if (rowKey_(name, r) === id) { found = true; return mergeRow_(r, row); } return r; });
    if (!found) all.push(row);
    writeTable_(name, all);
    return true;
  });
}

/** Troca a aba inteira pela lista enviada; linhas que continuam mantêm os campos não enviados. */
function api_replace(name, rows) {
  return withLock_(function () {
    ensureFields_(name, rows);
    var old = {};
    readTable_(name).forEach(function (r) { var id = rowKey_(name, r); if (id.replace(/\|/g, '')) old[id] = r; });
    writeTable_(name, rows.map(function (r) { var o = old[rowKey_(name, r)]; return o ? mergeRow_(o, r) : r; }));
    return true;
  });
}

function mergeRow_(oldRow, newRow) {
  var out = {};
  Object.keys(oldRow).forEach(function (f) { out[f] = oldRow[f]; });
  Object.keys(newRow).forEach(function (f) { out[f] = newRow[f]; });
  return out;
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
