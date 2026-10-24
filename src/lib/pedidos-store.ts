import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

export type PedidoStatus = "rascunho" | "enviado" | "confirmado" | "parcial" | "recebido" | "cancelado";

export type ItemPedido = {
  id: string;
  produtoId: string;
  qtdSolicitada: number;
  qtdRecebida: number;
  precoUnitario: number;
  unidade: string;
};

export type Pedido = {
  id: string;
  fornecedorId: string | null;
  fornecedorNome: string;
  numero: string;
  dataEmissao: string;
  dataPrevista: string;
  status: PedidoStatus;
  total: number;
  observacao: string;
  itens: ItemPedido[];
};

type Estado = { pedidos: Pedido[] };

const VAZIO: Estado = { pedidos: [] };
let estado: Estado = { ...VAZIO };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

function mapItem(r: Record<string, unknown>): ItemPedido {
  return {
    id: r.id as string,
    produtoId: (r.produto_id as string) ?? "",
    qtdSolicitada: (r.qtd_solicitada as number) ?? 0,
    qtdRecebida: (r.qtd_recebida as number) ?? 0,
    precoUnitario: (r.preco_unitario as number) ?? 0,
    unidade: (r.unidade as string) ?? "un",
  };
}

function mapPedido(r: Record<string, unknown>): Pedido {
  return {
    id: r.id as string,
    fornecedorId: (r.fornecedor_id as string) ?? null,
    fornecedorNome: (r.fornecedor_nome as string) ?? "",
    numero: (r.numero as string) ?? "",
    dataEmissao: (r.data_emissao as string) ?? "",
    dataPrevista: (r.data_prevista as string) ?? "",
    status: (r.status as PedidoStatus) ?? "rascunho",
    total: (r.total as number) ?? 0,
    observacao: (r.observacao as string) ?? "",
    itens: ((r.itens_pedido as unknown[]) ?? []).map((i) => mapItem(i as Record<string, unknown>)),
  };
}

// ─── Carregamento ────────────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

onLojaChange(async (lojaId) => {
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (!lojaId) { emitir({ ...VAZIO }); return; }

  const { data, error } = await supabase
    .from("pedidos_compra")
    .select("id, fornecedor_id, fornecedor_nome, numero, data_emissao, data_prevista, status, total, observacao, itens_pedido(id, produto_id, qtd_solicitada, qtd_recebida, preco_unitario, unidade)")
    .eq("loja_id", lojaId)
    .order("data_emissao", { ascending: false });

  if (error) { toast.error("Erro ao carregar pedidos"); return; }
  emitir({ pedidos: (data ?? []).map((r) => mapPedido(r as Record<string, unknown>)) });

  realtimeChannel = supabase
    .channel(`pedidos-${lojaId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos_compra", filter: `loja_id=eq.${lojaId}` }, (payload) => {
      const r = payload.new as Record<string, unknown>;
      emitir({ pedidos: estado.pedidos.map((p) => p.id === r.id ? { ...p, status: r.status as PedidoStatus, total: r.total as number } : p) });
    })
    .subscribe();
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePedidos(): Estado {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => estado, () => estado);
}

export function getPedidos(): Estado { return estado; }

const numeroPedido = () => `PC-${Date.now().toString().slice(-8)}`;

// ─── Criar pedido ─────────────────────────────────────────────────────────────

export function criarPedido(dados: {
  fornecedorId?: string;
  fornecedorNome: string;
  dataPrevista: string;
  observacao: string;
  itens: Omit<ItemPedido, "id" | "qtdRecebida">[];
}): string {
  const lojaId = getLojaId();
  if (!lojaId) { toast.error("Loja não carregada"); return ""; }

  const id = crypto.randomUUID();
  const numero = numeroPedido();
  const total = dados.itens.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0);
  const dataEmissao = new Date().toISOString().slice(0, 10);

  const pedido: Pedido = {
    id,
    fornecedorId: dados.fornecedorId ?? null,
    fornecedorNome: dados.fornecedorNome,
    numero,
    dataEmissao,
    dataPrevista: dados.dataPrevista,
    status: "rascunho",
    total,
    observacao: dados.observacao,
    itens: dados.itens.map((i) => ({ ...i, id: crypto.randomUUID(), qtdRecebida: 0 })),
  };

  emitir({ pedidos: [pedido, ...estado.pedidos] });

  supabase.from("pedidos_compra").insert({
    id, loja_id: lojaId, fornecedor_id: dados.fornecedorId ?? null, fornecedor_nome: dados.fornecedorNome,
    numero, data_emissao: dataEmissao, data_prevista: dados.dataPrevista || null,
    status: "rascunho", total, observacao: dados.observacao || null,
  }).then(({ error }) => { if (error) toast.error("Erro ao criar pedido: " + error.message); });

  for (const item of pedido.itens) {
    supabase.from("itens_pedido").insert({
      id: item.id, pedido_id: id, produto_id: item.produtoId,
      qtd_solicitada: item.qtdSolicitada, qtd_recebida: 0,
      preco_unitario: item.precoUnitario, unidade: item.unidade,
    }).then(({ error }) => { if (error) toast.error("Erro ao salvar item: " + error.message); });
  }

  return id;
}

// ─── Atualizar status ─────────────────────────────────────────────────────────

export function atualizarStatusPedido(id: string, status: PedidoStatus): void {
  emitir({ pedidos: estado.pedidos.map((p) => (p.id === id ? { ...p, status } : p)) });
  supabase.from("pedidos_compra").update({ status }).eq("id", id)
    .then(({ error }) => { if (error) toast.error("Erro ao atualizar status: " + error.message); });
}

// ─── Registrar recebimento de item ────────────────────────────────────────────

export function receberItemPedido(pedidoId: string, itemId: string, qtdRecebida: number): void {
  const pedido = estado.pedidos.find((p) => p.id === pedidoId);
  if (!pedido) return;

  const itensAtualizados = pedido.itens.map((i) => (i.id === itemId ? { ...i, qtdRecebida } : i));
  const tudo = itensAtualizados.every((i) => i.qtdRecebida >= i.qtdSolicitada);
  const algo = itensAtualizados.some((i) => i.qtdRecebida > 0);
  const novoStatus: PedidoStatus = tudo ? "recebido" : algo ? "parcial" : pedido.status;

  emitir({ pedidos: estado.pedidos.map((p) => (p.id === pedidoId ? { ...p, itens: itensAtualizados, status: novoStatus } : p)) });

  supabase.from("itens_pedido").update({ qtd_recebida: qtdRecebida }).eq("id", itemId)
    .then(({ error }) => { if (error) toast.error("Erro ao atualizar item: " + error.message); });

  if (novoStatus !== pedido.status) {
    supabase.from("pedidos_compra").update({ status: novoStatus }).eq("id", pedidoId)
      .then(({ error }) => { if (error) toast.error("Erro ao atualizar status: " + error.message); });
  }
}
