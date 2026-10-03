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

No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**,
escolha o branch e a pasta `/ (root)`. O Caixa fica em
`https://leonardo-pizzi.github.io/caixa/`.
