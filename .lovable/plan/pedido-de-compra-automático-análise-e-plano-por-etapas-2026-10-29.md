# Pedido de Compra Automático — análise e plano por etapas

## O que está confuso hoje (análise das imagens e do sistema)

1. **Dois avisos misturados na mesma tela.** Aparecem "produtos abaixo do mínimo" (gôndola) e "depósito abaixo do mínimo" com os mesmos 7 produtos e dois botões diferentes. Gôndola baixa não é motivo de compra — é motivo de **reposição** (o repositor tira do depósito). Compra só deve olhar o **depósito**.
2. **Pedido junta fornecedores errado.** Ao criar automático, o sistema pega o fornecedor do primeiro produto e coloca todos os itens nele. Produtos de fornecedores diferentes acabam no mesmo pedido.
3. **Produto sem fornecedor fica perdido.** Não há como ligar o fornecedor ali na hora.
4. **Quantidade sem sentido.** "pedir 5" / "pedir 10" é sempre o mínimo, em unidades soltas. O fornecedor vende em caixa/fardo (ex.: fardo com 12).
5. **Botão do WhatsApp escondido.** Só aparece dentro do pedido e só se o fornecedor tiver WhatsApp cadastrado; não diz o que falta.
6. **Pedidos repetidos.** Clicando duas vezes, podem nascer pedidos duplicados do mesmo produto.

## Como vai funcionar (regra do pedido automático)

O sistema confere o depósito de cada produto em dois casos:
- **Chegou ao mínimo do depósito** (definido no cadastro do produto), ou
- **Acabou** (depósito zerado).

Nesses casos o produto entra na lista **"Precisa comprar"**, desde que ainda não esteja num pedido aberto.

**Quanto pedir:** completar até o máximo do depósito (ou 2× o mínimo, se não houver máximo), arredondando para **caixas/fardos fechados** do fornecedor.

**Agrupamento:** um rascunho de pedido **por fornecedor**.

## Nova tela de Pedidos de Compra (mais simples)

```text
[ Precisa comprar (7) ]  [ Pedidos abertos ]  [ Recebidos ]  [ Cancelados ]

Precisa comprar — separado por fornecedor:
  Unilever Brasil  (WhatsApp ok)           [Revisar e enviar]
    Sabonete Dove 90g    depósito 0 / mín 10   pedir 2 cx (24 un)
    ...
  Sem fornecedor  (2)                      [Vincular fornecedor]
    Água Crystal 500ml   depósito 0 / mín 10   [escolher fornecedor ▼]
```

- Um só aviso no topo: "7 produtos precisam ser comprados".
- **Revisar e enviar**: abre o rascunho, o dono ajusta as quantidades e clica **Enviar pelo WhatsApp**. A mensagem já vai pronta para o fornecedor (itens, quantidades em caixas, código de barras, nome da loja). O pedido fica como "Enviado" na hora.
- Se o fornecedor não tiver WhatsApp: aparece um campo para digitar o número ali mesmo, e ele fica salvo no fornecedor.

## Vincular produto a fornecedor

- Na lista "Sem fornecedor": escolher o fornecedor ou cadastrar um novo ali mesmo, sem sair da tela.
- No cadastro do produto: campo de fornecedor obrigatório para compra automática, com a quantidade por caixa.
- (Depois) mais de um fornecedor por produto, com um marcado como principal.

## Etapas (cada uma com sua conferência antes de seguir)

**Etapa A — Regra certa e sem duplicados**
Compra olha só o depósito; produto em pedido aberto não entra de novo; separa por fornecedor.
Conferência: produto com depósito 0 aparece uma vez só; dois fornecedores geram dois rascunhos.

**Etapa B — Tela "Precisa comprar"**
Nova aba agrupada por fornecedor; tira o aviso duplicado da gôndola (vai para Reposição).
Conferência: tela abre com os 7 produtos, cada um no fornecedor certo.

**Etapa C — Vincular fornecedor na hora**
Grupo "Sem fornecedor" com escolha/cadastro rápido; salva no produto.
Conferência: vincular, recarregar a página e o produto continua ligado.

**Etapa D — Quantidade em caixas**
Sugestão até o máximo, arredondada para caixa/fardo.
Conferência: mínimo 10, fardo 12 → sugere 1 fardo (12 un).

**Etapa E — Enviar pelo WhatsApp com um clique**
Botão no grupo e no pedido; mensagem pronta; status muda para "Enviado"; pede número se faltar.
Conferência: o WhatsApp abre com a mensagem certa e o pedido muda de status.

**Etapa F (opcional, depois) — Envio automático direto pelo sistema**
Com a conexão oficial do WhatsApp Business, o pedido sai sem abrir o celular e o sistema mostra "entregue/lido". Exige conta WhatsApp Business, aprovação do Meta (até 48h) e um modelo de mensagem aprovado.

## Detalhes técnicos
- Corrigir o agrupamento em `painel.pedidos.index.tsx` / `painel.pedidos.sugerir.tsx` (hoje usa o fornecedor do primeiro item).
- Regra de sugestão em função única em `pedidos-store.ts`, com testes (mínimo, zerado, arredondamento por caixa, sem duplicar pedido aberto).
- Etapas A–E usam link `wa.me` (sem custo e sem aprovação); a etapa F usa o conector WhatsApp.
- Cada etapa salva no banco e é conferida recarregando a página.
