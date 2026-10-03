// Receitas e despesas fixas: dia útil, feriados, valor por dia útil, reajuste,
// mês pago no crédito, encerrar, pular mês e meses novos criados sozinhos.
const { browser, connect, dump, ok, saved, pageErrors, L } = require('./browser');
module.exports = async function () {
  const { b, ctx } = await browser();
  let p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-10-03T12:00:00'));
  pageErrors(p);
  await connect(p);

  // calendário
  const cal = await p.evaluate(() => { const C = window.__caixa; return {
    pascoa: C.easter(2026), out: C.bizDays('2026-10', false).length, nov: C.bizDays('2026-11', false).length,
    sal: C.ruleOccurrence({ diaModo: 'util', dia: 5, valor: 3000, valorModo: 'fixo' }, '2026-11').data,
    salSab: C.ruleOccurrence({ diaModo: 'util', dia: 5, sabado: true, valor: 3000, valorModo: 'fixo' }, '2026-11').data,
    ult: C.ruleOccurrence({ diaModo: 'ultimo', valor: 1, valorModo: 'fixo' }, '2026-10').data }; });
  ok(cal.pascoa === '2026-04-05', 'Páscoa 2026', cal.pascoa);
  ok(cal.out === 21 && cal.nov === 19, 'dias úteis: out/2026 = 21 (12/10), nov/2026 = 19 (02 e 20/11)', [cal.out, cal.nov]);
  ok(cal.sal === '2026-11-09' && cal.salSab === '2026-11-07', '5º dia útil de nov: 09/11 (seg–sex) e 07/11 (com sábado)', [cal.sal, cal.salSab]);
  ok(cal.ult === '2026-10-30', 'último dia útil de out = 30/10', cal.ult);

  // salário: começa no Novo lançamento e vira recorrência pelo "Todo mês"
  await p.click('.newbtn');
  await p.click('#txForm button[data-tipo=Receita]');
  await p.fill('#txForm [name=valor]', '3000'); await p.fill('#txForm [name=descricao]', 'Salário NIX');
  await p.selectOption('#txForm [name=categoria]', 'Salário');
  await p.click('#txForm button[data-modo=recorrente]');
  await p.waitForSelector('#ruleForm');
  ok(await p.inputValue('#ruleForm [name=descricao]') === 'Salário NIX' && await p.inputValue('#ruleForm [name=valor]') === '3000', 'dados digitados passam para a recorrência');
  await p.check('#ruleForm input[name=diaModo][value=util]');
  await p.fill('#ruleForm [name=dia]', '5');
  const prev = await p.textContent('#rPreview');
  ok(/07\/10\/2026/.test(prev) && /09\/11\/2026/.test(prev) && /Sem data de fim/.test(prev), 'prévia mostra 07/10 e 09/11, sem fim', prev);
  await p.click('#ruleForm button[type=submit]'); await saved(p);
  let d = await dump();
  let sal = d.tx.filter(t => t.descricao === 'Salário NIX');
  ok(d.rules.length === 1 && sal.length === 13, 'salário: regra salva e 13 meses lançados (out/26 a out/27)', sal.length);
  ok(sal.find(t => t.vencimento === '2026-10-07') && sal.every(t => t.valor === 3000 && t.status === 'Pendente'), 'salário: out em 07/10, R$ 3.000, pendente');

  // alimentação: R$ 47 por dia útil do mês seguinte, junto com o salário
  await p.click('[data-act=rulenew] >> nth=0');
  await p.click('#ruleForm button[data-tipo=Receita]');
  await p.check('#ruleForm input[name=valorModo][value=diaUtil]');
  await p.fill('#ruleForm [name=valor]', '47');
  await p.check('#ruleForm input[name=refMes][value=proximo]');
  await p.fill('#ruleForm [name=descricao]', 'Vale-alimentação');
  await p.selectOption('#ruleForm [name=categoria]', '__new');
  await p.fill('#pf [name=v]', 'Alimentação'); await p.click('#pf .primary');
  await p.waitForSelector('#pf', { state: 'detached' });
  ok(await p.inputValue('#ruleForm [name=categoria]') === 'Alimentação', 'categoria de receita "Alimentação" criada');
  await p.check('#ruleForm input[name=diaModo][value=util]'); await p.fill('#ruleForm [name=dia]', '5');
  ok(/893,00/.test(await p.textContent('#rPreview')), 'prévia: out = 47 × 19 dias úteis de nov = R$ 893,00', await p.textContent('#rPreview'));
  await p.click('#ruleForm button[type=submit]'); await saved(p);
  d = await dump();
  let va = d.tx.filter(t => t.descricao === 'Vale-alimentação');
  ok(va.find(t => t.vencimento === '2026-10-07').valor === 893, 'alimentação de out na planilha = 893');

  // feriado da cidade em 05/11 → nov tem 18 dias úteis e o 5º dia útil vira 10/11
  await p.click('[data-act=settings]');
  await p.fill('[name=hData]', '05/11'); await p.fill('[name=hNome]', 'Feriado municipal'); await p.click('[data-hadd]');
  ok(/05\/11 \(todo ano\)/.test(await p.textContent('#holArea')), 'feriado da cidade aparece na lista');
  await p.click('#sf .primary'); await saved(p);
  await new Promise(r => setTimeout(r, 300));
  d = await dump();
  va = d.tx.filter(t => t.descricao === 'Vale-alimentação'); sal = d.tx.filter(t => t.descricao === 'Salário NIX');
  ok(va.find(t => t.id.endsWith('2026-10')).valor === 846, 'após feriado: alimentação de out = 47 × 18 = 846', va.find(t => t.id.endsWith('2026-10')).valor);
  ok(sal.find(t => t.id.endsWith('2026-11')).vencimento === '2026-11-10', 'após feriado: salário de nov em 10/11');
  ok(JSON.parse(d.cfg.feriadosExtras)[0].d === '11-05', 'feriado salvo na planilha (aba Config)');

  // pular um mês da alimentação (dez)
  await p.evaluate(() => { window.__caixa.S.view = 'lanc'; window.__caixa.S.lMode = 'venc'; window.__caixa.S.month = '2026-12'; window.__caixa.render(); });
  const vaDec = va.find(t => t.id.endsWith('2026-12')).id;
  await p.click(`.row[data-id="${vaDec}"]`);
  ok(/recorrência/.test(await p.textContent('#drawer .preview')), 'editar um mês avisa que é parte de uma recorrência');
  await p.click('#txForm [data-act=delete]'); await p.click('#modal button:has-text("Só este mês")'); await saved(p);

  // encerrar o salário em out/2026 (saí da empresa)
  await p.evaluate(() => { window.__caixa.S.view = 'fluxo'; window.__caixa.render(); });
  await p.click('.row[data-act=ruleedit]:has-text("Salário NIX")');
  await p.click('#ruleForm [data-x=end]');
  ok(await p.inputValue('#ruleForm [name=fim]') === '2026-10', 'Encerrar coloca out/2026 como último mês');
  await p.click('#ruleForm button[type=submit]'); await saved(p);
  await new Promise(r => setTimeout(r, 300));
  d = await dump();
  ok(d.tx.filter(t => t.descricao === 'Salário NIX').length === 1, 'salário encerrado: só out/2026 ficou');
  ok(await p.isVisible('text=até outubro/26'), 'lista mostra "até outubro/26"');

  // despesa fixa: aluguel R$ 1.500 todo dia 10, no Pix
  await p.evaluate(() => { window.__caixa.S.view = 'cartoes'; window.__caixa.render(); });
  await p.click('[data-act=cardnew] >> nth=0');
  await p.fill('#cf [name=nome]', 'Nubank'); await p.fill('#cf [name=fechamento]', '25'); await p.fill('#cf [name=vencimento]', '5');
  await p.click('#cf .primary'); await saved(p);
  await p.evaluate(() => { window.__caixa.S.view = 'fluxo'; window.__caixa.render(); });
  await p.click('[data-act=rulenew] >> nth=0');
  await p.fill('#ruleForm [name=valor]', '1500'); await p.fill('#ruleForm [name=descricao]', 'Aluguel');
  await p.selectOption('#ruleForm [name=categoria]', 'Moradia');
  await p.fill('#ruleForm [name=dia]', '10');
  await p.click('#ruleForm button[type=submit]'); await saved(p);
  d = await dump();
  ok(d.tx.filter(t => t.descricao === 'Aluguel' && t.tipo === 'Despesa' && t.forma === 'Pix').length === 13, 'aluguel: despesa fixa com 13 meses no Pix');

  // novembro foi pago no crédito à vista
  const novId = d.tx.find(t => t.descricao === 'Aluguel' && t.id.endsWith('2026-11')).id;
  await p.evaluate(() => { window.__caixa.S.view = 'lanc'; window.__caixa.S.lMode = 'venc'; window.__caixa.S.month = '2026-11'; window.__caixa.render(); });
  await p.click(`.row[data-id="${novId}"]`);
  await p.check('#txForm input[name=forma][value="Crédito"]');
  ok(await p.inputValue('#txForm [name=vencimento]') === '2026-12-05', 'trocar para crédito muda o vencimento para a fatura (05/12)', await p.inputValue('#txForm [name=vencimento]'));
  await p.click('#txForm button[type=submit]'); await saved(p);

  // reajuste: R$ 1.650 a partir de janeiro/2027
  await p.evaluate(() => { window.__caixa.S.view = 'fluxo'; window.__caixa.render(); });
  await p.click('.row[data-act=ruleedit]:has-text("Aluguel")');
  ok(await p.isHidden('#desdeBox'), '"a partir de" só aparece quando o valor muda');
  await p.fill('#ruleForm [name=valor]', '1650');
  await p.selectOption('#ruleForm [name=desde]', '2027-01');
  await p.click('#ruleForm button[type=submit]'); await saved(p);
  await new Promise(r => setTimeout(r, 300));
  d = await dump();
  const al = ym => d.tx.find(t => t.descricao === 'Aluguel' && t.id.endsWith(ym));
  ok(al('2026-12').valor === 1500 && al('2027-01').valor === 1650 && al('2027-10').valor === 1650, 'reajuste: dez = 1.500, jan e depois = 1.650');
  ok(al('2026-11').forma === 'Crédito' && al('2026-11').vencimento === '2026-12-05', 'novembro continua no crédito após editar a fixa');
  ok(al('2026-10').valor === 1500, 'outubro mantém 1.500');

  // dois meses depois: completa sozinho os meses novos da alimentação, sem recriar dez nem o salário
  const p2 = await ctx.newPage();
  await p2.clock.setFixedTime(new Date('2026-12-03T12:00:00'));
  await p2.goto(L + '/'); await p2.waitForSelector('#boot', { state: 'hidden' }); await saved(p2);
  await new Promise(r => setTimeout(r, 500));
  d = await dump();
  va = d.tx.filter(t => t.descricao === 'Vale-alimentação');
  ok(va.some(t => t.id.endsWith('2027-12')) && !va.some(t => t.id.endsWith('2026-12')), 'em dez/26: criou até dez/27 e não recriou o mês pulado', va.length);
  ok(d.tx.filter(t => t.descricao === 'Salário NIX').length === 1, 'salário encerrado não volta');
  await b.close();
};
