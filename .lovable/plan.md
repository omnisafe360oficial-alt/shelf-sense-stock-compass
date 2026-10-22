# OmniSafe 360 — Planejamento do Painel Web

Sobre o erro enviado: os arquivos citados (Features.tsx e Landing.tsx) não existem neste projeto. O erro vem de uma versão antiga ou de outro projeto, então não precisa de correção aqui.

## Visão geral
Painel web para o comerciante (supermercado, farmácia, sorveteria, loja de roupas) controlar estoque de ponta a ponta: cadastro, depósito, gôndola, validade por lote, PDV e alertas de reposição. Depois, dois aplicativos separados (Recebimento e Repositor) vão usar os mesmos dados.

## Identidade visual
- Nome: OmniSafe 360. Logo: escudo com anel 360° (proteção + visão total), usado em todas as telas.
- Cores: azul petróleo profundo (principal), verde-esmeralda (sucesso/estoque ok), âmbar (atenção/vencendo), vermelho coral (crítico). Fundo claro e limpo, menu lateral escuro.
- Fontes: Sora (títulos) + Manrope (textos). Visual de software corporativo, com cartões, gráficos e muito espaço.

## Mapa do sistema
```text
Entrada
 ├─ Login (Google ou e-mail/senha)
 ├─ Cadastro rápido (nome, e-mail, senha)
 └─ Configurar loja (3 passos): tipo de comércio → nome da loja + CPF/CNPJ → cidade/UF

Painel (menu lateral)
 ├─ Início (resumo): vendas do dia, itens abaixo do mínimo, lotes vencendo, inconsistências
 ├─ Produtos
 │   ├─ Lista com busca, filtros e situação do estoque
 │   ├─ Novo produto (assistente por etapas)
 │   └─ Importar XML (NF-e) em massa
 ├─ Fornecedores (lista + ficha com produtos fornecidos)
 ├─ Estoque
 │   ├─ Depósito (lotes, quantidades, localização)
 │   ├─ Gôndola (quantidade exposta, mínimo, transferências)
 │   └─ Movimentações (histórico de entradas, saídas, transferências)
 ├─ Validades (lotes por prazo: vencidos, 7, 15, 30 dias)
 ├─ PDV (caixa: bipar código, carrinho, finalizar venda)
 ├─ Reposição (pedidos gerados quando a gôndola bate o mínimo)
 ├─ Recebimentos (conferências cegas vindas do app)
 ├─ Inconsistências (diferenças das conferências)
 ├─ Relatórios
 ├─ Equipe (caixas, repositores, conferentes e acessos)
 └─ Configurações da loja
```

## Assistente de cadastro de produto (passo a passo)
1. Identificação: código de barras (digitar ou bipar), nome, categoria, marca, foto.
2. Fornecedor: escolher existente ou cadastrar ali mesmo (nome, CNPJ, contato).
3. Unidades e conversão: unidade de venda (un, kg, L) e embalagem de compra (ex.: 1 caixa = 12 un).
4. Preços: custo, preço de venda, margem calculada automaticamente.
5. Depósito: lote, data de validade, quantidade inicial, local (corredor/prateleira).
6. Gôndola: quantidade exposta, estoque mínimo (aviso ao repositor), capacidade máxima.
7. Revisão e salvar.
Campos aparecem conforme o tipo de comércio (ex.: loja de roupas pede tamanho/cor e esconde validade; farmácia destaca lote).

## Importação por XML
Enviar o XML da nota → sistema lê fornecedor, produtos, códigos, quantidades, custos e conversões → tela de conferência mostrando o que é novo e o que já existe → comerciante completa só o que falta (preço de venda, mínimo da gôndola, validade) → confirmar.

## Fluxos que se fecham
```text
Nota/XML ou App Recebimento (conferência cega) → Depósito (por lote)
Depósito → Transferência → Gôndola
PDV vende → baixa da Gôndola → atingiu mínimo → Pedido de Reposição → App Repositor
Repositor confere (cega) → bate: repõe | não bate: Inconsistência no painel
Validades monitoram os lotes do Depósito e da Gôndola (primeiro a vencer, primeiro a sair)
```
Exemplo: 20 sabonetes na gôndola, mínimo 10. Ao vender o 10º, o pedido de reposição aparece para o repositor.

## Etapas de construção (uma tela visível por etapa, com seu ok entre elas)
1. Identidade + Login + Cadastro + Configurar loja (3 passos).
2. Estrutura do painel (menu lateral, topo) + tela Início com indicadores.
3. Lista de Produtos + assistente de cadastro em etapas.
4. Fornecedores (lista e ficha).
5. Importação por XML com tela de conferência.
6. Estoque: Depósito, Gôndola, Movimentações e transferência.
7. Validades por lote com alertas.
8. PDV (bipar, carrinho, finalizar, baixa da gôndola).
9. Reposição + Recebimentos + Inconsistências (telas que os apps vão alimentar).
10. Relatórios, Equipe e Configurações.
11. Conectar tudo a dados reais (contas, banco de dados, login Google) — telas primeiro, como você pediu; até aqui usam dados de exemplo.

Este plano será salvo também como roteiro do projeto (fonte da verdade), marcando cada etapa concluída.

## Sugestões extras
- Curva ABC (o que mais vende e dá lucro) e sugestão automática de compra.
- Alerta de produto parado (sem venda há X dias) e promoção sugerida para lotes perto do vencimento.
- Inventário geral periódico com contagem cega.
- Etiquetas de preço e de gôndola para imprimir.
- Várias lojas/filiais na mesma conta.
- Registro de perdas e quebras (vencido, avariado, furto).
- Notificações por WhatsApp/e-mail para o dono.

## Detalhes técnicos
- Rotas separadas por área (login, onboarding, painel/*). Design system em tokens oklch.
- Etapas 1–10 com dados de exemplo locais; etapa 11 ativa Lovable Cloud (auth e-mail + Google, tabelas: lojas, produtos, fornecedores, lotes, estoque_deposito, estoque_gondola, movimentacoes, vendas, pedidos_reposicao, conferencias, inconsistencias, membros/papéis).
- Baixa da gôndola e geração de reposição feitas no servidor, para os apps futuros usarem a mesma regra.
