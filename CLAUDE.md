# Caixa — regras do projeto

Controle financeiro pessoal. O **site** (este repositório, GitHub Pages) é só a
lógica e as telas. O **banco de dados** é uma planilha Google do dono, acessada
pelo script `script/Code.gs` (Apps Script). O banco é **universal**: precisa
sobreviver a qualquer mudança no site e poder ser reaproveitado por uma lógica
totalmente nova. Os dados são pessoais e reais — perder dado é o pior erro possível.

## Regras do banco de dados (nunca quebrar)

1. **Nunca apagar nem renomear** aba ou coluna. Para mudar o significado de um
   campo, crie um campo novo, copie os dados com uma migração e pare de usar o antigo.
2. **Novos campos/abas**: declare em `SCHEMA` (`js/dados.js`) com `desc`/`fields`
   (vão para a aba `_Dicionario` da planilha). O script cria colunas e abas sozinho.
   Campos enviados sem declarar também viram coluna (nunca são descartados).
3. **Formatos neutros**: datas `AAAA-MM-DD`, meses `AAAA-MM`, valores em reais como
   número positivo (o sinal vem de `tipo`), sim/não como booleano. Nada de formato
   que só este site entenda quando houver alternativa simples.
4. **Escritas preservam o que não conhecem**: ao salvar um item, parta do objeto
   existente (`Object.assign({}, existente, mudanças)`) ou use `update` (patch).
   O script também mescla em `upsert`/`replace`.
5. **Mudança de formato = migração** (`MIGRATIONS` em `js/dados.js`): número novo,
   idempotente, sem apagar o campo antigo. Roda uma vez, após backup automático.
6. **Evitar mudar `script/Code.gs`.** Ele é genérico de propósito; mudar exige o dono
   colar o código no Apps Script e criar nova versão da implantação. Se for
   inevitável: só acrescente, mantenha as ações antigas (filas de aparelhos podem
   tê-las) e atualize `tests/fixtures` se mudar o comportamento de dados.

## Organização

- `index.html`, `styles.css` — página e aparência.
- `js/` (carregados em ordem pelo `index.html`, escopo global compartilhado):
  - `util.js` datas/formatação · `dominio.js` cartão, parcelas, dias úteis, feriados, fixas
  - `dados.js` SCHEMA, estado `S`, fila offline, `commit()`, `rowsOf(aba)`, migrações
  - `calculos.js` saldo/fluxo/análises · `telas/*` cada tela · `formularios/*` gavetas e janelas
  - `app.js` eventos, conexão e início (por último)
- Dados em memória: `S.tx` (Lancamentos), `S.cards` (Cartoes), `S.cats` (Categorias),
  `S.rules` (Recorrencias), `S.cfg` (Config), `S.extra[aba]` (abas novas). Use `rowsOf(aba)`.
- Alterações: `commit(() => mudarS(), [['add'|'update'|'remove'|'upsert'|'replace', aba, ...], ...])`.
  A fila fica no aparelho até a planilha confirmar; nada é perdido sem internet.

## Testes (obrigatório antes de enviar)

`npm test` — simula o Apps Script (`tests/sim`) e usa o Chromium para testar o site.
Toda funcionalidade nova ganha teste; toda mudança de dados ganha teste em
`tests/script.test.js`. No GitHub, o site só é publicado se os testes passarem.

## Comunicação com o dono

Português do Brasil, explicando o que e por quê, passo a passo, sem jargão.
