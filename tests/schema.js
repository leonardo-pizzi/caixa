// Lê o SCHEMA declarado em js/dados.js, para os testes usarem o mesmo esquema do site.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dados.js'), 'utf8');
const a = src.indexOf('const SCHEMA = {'), b = src.indexOf('\n};', a) + 3;
module.exports = vm.runInNewContext('(' + src.slice(a + 'const SCHEMA = '.length, b - 1) + ')');
