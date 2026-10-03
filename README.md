# Caixa — controle financeiro

O site fica neste repositório (GitHub Pages). Os dados ficam numa **planilha Google**,
que é atualizada pelo script de `script/Code.gs`.

## Como os dados ficam sempre salvos

- Cada alteração é gravada **primeiro no aparelho** e depois enviada à planilha.
  Se a internet cair ou o Google falhar, ela fica guardada e é reenviada sozinha:
  ao voltar a conexão, ao reabrir a página ou ao tocar no aviso no canto da tela.
- O aviso no menu mostra a situação: **Tudo salvo na planilha**, **Salvando…**
  ou **N alterações guardadas neste aparelho**.
- O script tira uma **cópia da planilha por dia** para a pasta *Caixa - backups*
  do seu Drive e guarda as 30 mais recentes.
- Em **Ajustes → Baixar cópia (JSON)** você baixa tudo quando quiser.

## Receitas e despesas fixas

Em **Fluxo de caixa → Receitas e despesas fixas → Nova fixa** (ou **Todo mês** no
Novo lançamento) você cadastra o que se repete: salário, benefícios, aluguel,
assinaturas. O site lança sozinho os próximos 12 meses e completa os novos a cada mês.

- **Quando cai:** dia fixo, Nº dia útil (ex.: 5º) ou último dia útil; sábado pode contar.
- **Valor:** fixo, ou por dia útil (ex.: R$ 47 × dias úteis do próprio mês ou do seguinte).
- **Sem data de fim**, ou com um mês final. **Encerrar** para a partir do mês escolhido.
- **Reajuste:** ao mudar o valor, escolha a partir de que mês ele vale.
- **Um mês diferente** (ex.: pago no crédito): edite só aquele mês na lista; a fixa
  não mexe mais nele.
- **Feriados** (Ajustes): nacionais, Carnaval/Corpus Christi opcionais e os da sua cidade.

## Banco de dados universal

A planilha é o banco de dados e foi feita para durar mais que o site:

- **Nada é apagado nem renomeado.** Abas e colunas novas são criadas sozinhas; campos
  que uma tela não conhece são mantidos quando ela salva algo.
- **Aba `_Dicionario`**: descreve cada aba e coluna (tipo, chave e significado), para
  qualquer programa futuro entender e reaproveitar os dados.
- **Formatos simples**: datas `AAAA-MM-DD`, valores numéricos, sim/não.
- **Migrações**: se o formato de algo mudar, o site faz uma cópia de segurança e
  converte os dados uma única vez, sem apagar o original.
- O script é genérico: melhorias no site não exigem mexer nele.

## Atualizar o script

Raro. Só se o `script/Code.gs` mudar: copie o novo conteúdo para o editor do Apps
Script, salve e vá em **Implantar → Gerenciar implantações → ✏️ → Versão: Nova
versão → Implantar**. Os dados, o endereço `/exec` e a chave continuam os mesmos.

## Desenvolvimento

`npm install` e `npm test` rodam os testes (simulam o Google, sem precisar de conta).
A cada envio ao `main`, o GitHub roda os testes e só publica o site se passarem.
Regras do projeto: [CLAUDE.md](CLAUDE.md).

## Instalação (uma vez só)

1. Abra o projeto no [Apps Script](https://script.google.com). Pode ser o projeto
   que você já usa: os dados continuam os mesmos.
2. Troque todo o conteúdo de `Code.gs` pelo arquivo `script/Code.gs`
   deste repositório. Os arquivos `Index`, `Style` e `Script` podem ser apagados.
3. No topo do editor, escolha a função **setup** e clique em **Executar**.
   Autorize o acesso quando o Google pedir.
4. Abra **Execuções** (ou o registro que aparece embaixo) e copie a
   **Chave de acesso**. Se precisar dela de novo, rode `mostrarChave`.
5. **Implantar → Nova implantação → App da Web**, com:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**

   Copie o endereço que termina em `/exec`.
6. Abra o site, cole o endereço e a chave e clique em **Conectar**. Faça isso uma
   vez em cada aparelho.

"Qualquer pessoa" é necessário para o site conseguir falar com o script; quem
não tiver a chave não lê nem altera nada. Se a chave vazar, rode `trocarChave`.

Ao mudar o `Code.gs` no futuro: **Implantar → Gerenciar implantações → editar →
Versão: Nova versão**. Assim o endereço `/exec` continua o mesmo.

## Publicar o site

No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. O Caixa fica em
`https://leonardo-pizzi.github.io/caixa/`.
