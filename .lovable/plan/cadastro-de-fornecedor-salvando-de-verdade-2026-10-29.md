# Cadastro de fornecedor salvando de verdade

## O que encontrei
- A tabela de fornecedores existe no banco e responde.
- O botão "Novo fornecedor" envia o fornecedor ao banco, mas só se a loja do usuário foi encontrada. Se a loja não foi encontrada, nada é enviado e mesmo assim aparece "Fornecedor cadastrado!".
- A mensagem de sucesso aparece antes de o banco responder. Se o banco recusar, o fornecedor aparece na tela, some ao recarregar, e o aviso de erro passa rápido.
- Na sua imagem a lista está com 0 fornecedores. Isso indica que os cadastros anteriores não ficaram salvos ou que a lista não está achando a loja.
- Daqui eu não consigo ver as regras de acesso do seu banco nem entrar como você. Por isso o motivo exato (loja não encontrada ou banco recusando) ainda precisa ser confirmado.

## O que vou fazer
1. **Salvar primeiro, confirmar depois:** o botão mostra "Salvando…", espera o banco responder e só então mostra "Fornecedor cadastrado!" e abre a ficha.
2. **Erro claro:** se o banco recusar, aparece uma mensagem que fica na tela dizendo o motivo, e o formulário continua preenchido para tentar de novo.
3. **Sem loja, sem cadastro fingido:** se a loja não foi encontrada, aparece o aviso "Sua conta não está ligada a uma loja. Termine a configuração da loja." com um botão que leva até lá.
4. **Lista sempre atualizada:** depois de salvar, a lista é recarregada do banco, então o que aparece é o que realmente ficou salvo. A mesma regra vale para editar e excluir.
5. **Teste no seu login:** cadastro um fornecedor de teste, recarrego a página e confiro se ele continua lá.

## Pode precisar de você
Se o banco recusar por causa das regras de acesso, vou te passar um texto pronto para colar no painel do banco, que libera o dono da loja para cadastrar fornecedores.

## Detalhes técnicos
- `cadastrarFornecedor`, `editarFornecedor` e `excluirFornecedor` em `src/lib/fornecedores-store.ts` passam a ser async: usam `insert().select().single()`, lançam erro quando não há `lojaId`, e só atualizam o estado local depois do sucesso (ou chamam `carregarFornecedores`).
- `painel.fornecedores.novo.tsx` e o modal da lista passam a esperar a resposta, com estado de "salvando".
- Política esperada: `INSERT/SELECT/UPDATE/DELETE` em `fornecedores` para `authenticated` quando `loja_id` estiver em `membros` do `auth.uid()`, mais `GRANT` para `authenticated`.
