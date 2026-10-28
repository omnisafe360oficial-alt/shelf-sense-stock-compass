import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Produto } from "./mock-data";

import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { gravarAudit } from "./audit-store";

let estado: Produto[] = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

function mapDoBanco(row: Record<string, unknown>): Produto {
  const lotes = (row.lotes as { qtd: number }[] | null) ?? [];
  const gondola = (row.gondola as { qtd_gondola: number }[] | null) ?? [];
  return {
    id: row.id as string,
    nome: (row.nome as string) ?? "",
    codigo: (row.codigo as string) ?? "",
    categoria: (row.categoria as string) ?? "",
    fornecedor: (row.fornecedor_nome as string) ?? "",
    preco: (row.preco_venda as number) ?? 0,
    deposito: lotes.reduce((s, l) => s + (l.qtd ?? 0), 0),
    gondola: gondola[0]?.qtd_gondola ?? 0,
    minimo: (row.minimo as number) ?? 0,
    maximo: (row.maximo_gondola as number) ?? 0,
    custoUltimaCompra: (row.custo_ultima_compra as number) ?? 0,
    validade: (row.validade_padrao_dias as unknown as string) ?? undefined,
    localDeposito: (row.local_deposito as Produto["localDeposito"]) ?? undefined,
    localGondola: (row.local_gondola as Produto["localGondola"]) ?? undefined,
    unidade: (row.unidade as string) ?? "un",
    parentId: (row.parent_id as string) ?? undefined,
    variante: (row.variante as string) || undefined,
  };
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function carregarProdutos(lojaId: string) {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, codigo, categoria, fornecedor_nome, preco_venda, minimo, maximo_gondola, custo_ultima_compra, validade_padrao_dias, local_deposito, local_gondola, unidade, parent_id, variante, lotes(qtd), gondola(qtd_gondola)")
    .eq("loja_id", lojaId)
    .order("nome");
  if (error) { toast.error("Erro ao carregar produtos"); return; }
  estado = (data ?? []).map((row) => mapDoBanco(row as Record<string, unknown>));
  notificar();
}

onLojaChange(async (lojaId) => {
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (!lojaId) { estado = []; notificar(); return; }

  await carregarProdutos(lojaId);

  realtimeChannel = supabase
    .channel(`produtos-${lojaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "produtos", filter: `loja_id=eq.${lojaId}` }, () => {
      carregarProdutos(lojaId);
    })
    .subscribe();
});

export function useProdutos(): Produto[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getProdutos(): Produto[] { return estado; }

export function cadastrarProduto(dados: Omit<Produto, "id">): string {
  const id = crypto.randomUUID();
  estado = [...estado, { ...dados, id }];
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    supabase
      .from("produtos")
      .insert({
        id,
        loja_id: lojaId,
        nome: dados.nome,
        codigo: dados.codigo,
        categoria: dados.categoria,
        fornecedor_nome: dados.fornecedor,
        preco_venda: dados.preco,
        minimo: dados.minimo,
        maximo_gondola: dados.maximo ?? 0,
        custo_ultima_compra: dados.custoUltimaCompra ?? 0,
        validade_padrao_dias: dados.validade ?? null,
        local_deposito: dados.localDeposito ?? null,
        local_gondola: dados.localGondola ?? null,
        unidade: dados.unidade ?? "un",
        parent_id: dados.parentId ?? null,
        variante: dados.variante ?? "",
      })
      .then(({ error }) => { if (error) toast.error("Erro ao salvar produto: " + error.message); });
    gravarAudit({ acao: "criar", modulo: "Produtos", descricao: `Produto "${dados.nome}" cadastrado.`, usuarioNome: "Sistema", produtoId: id, produtoNome: dados.nome });
  } else {
    toast.error("Sessão não identificada — faça login novamente para salvar produtos.");
  }
  return id;
}

export function cadastrarVariante(parentId: string, dados: Omit<Produto, "id" | "deposito" | "gondola">): string {
  return cadastrarProduto({ ...dados, deposito: 0, gondola: 0, parentId });
}

export function editarProduto(id: string, dados: Partial<Omit<Produto, "id">>): void {
  estado = estado.map((p) => (p.id === id ? { ...p, ...dados } : p));
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    const payload: Record<string, unknown> = {};
    if (dados.nome !== undefined) payload.nome = dados.nome;
    if (dados.codigo !== undefined) payload.codigo = dados.codigo;
    if (dados.categoria !== undefined) payload.categoria = dados.categoria;
    if (dados.fornecedor !== undefined) payload.fornecedor_nome = dados.fornecedor;
    if (dados.preco !== undefined) payload.preco_venda = dados.preco;
    if (dados.minimo !== undefined) payload.minimo = dados.minimo;
    if (dados.maximo !== undefined) payload.maximo_gondola = dados.maximo;
    if (dados.custoUltimaCompra !== undefined) payload.custo_ultima_compra = dados.custoUltimaCompra;
    if ("localDeposito" in dados) payload.local_deposito = dados.localDeposito ?? null;
    if ("localGondola" in dados) payload.local_gondola = dados.localGondola ?? null;
    if (dados.unidade !== undefined) payload.unidade = dados.unidade;
    if (dados.variante !== undefined) payload.variante = dados.variante;
    const nomeProd = estado.find((p) => p.id === id)?.nome ?? id;
    supabase
      .from("produtos")
      .update(payload)
      .eq("id", id)
      .then(({ error }) => { if (error) toast.error("Erro ao atualizar produto: " + error.message); });
    gravarAudit({ acao: "editar", modulo: "Produtos", descricao: `Produto "${nomeProd}" editado.`, usuarioNome: "Sistema", produtoId: id, produtoNome: nomeProd });
  }
}

export function excluirProduto(id: string): void {
  const nomeProd = estado.find((p) => p.id === id)?.nome ?? id;
  estado = estado.filter((p) => p.id !== id);
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .then(({ error }) => { if (error) toast.error("Erro ao excluir produto: " + error.message); });
    gravarAudit({ acao: "excluir", modulo: "Produtos", descricao: `Produto "${nomeProd}" excluído.`, usuarioNome: "Sistema", produtoId: id, produtoNome: nomeProd });
  }
}
