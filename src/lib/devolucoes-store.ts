import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { ajustarGondola, estadoAtual } from "./estoque-store";
import { gravarAudit } from "./audit-store";

export type MotivoDevolucao = "avaria" | "vencido" | "excesso" | "troca" | "outros";

export type DevolucaoItem = {
  id: string;
  devolucaoId: string;
  produtoId: string;
  produtoNome: string;
  qtd: number;
  precoUnitario: number;
};

export type Devolucao = {
  id: string;
  tipo: "cliente" | "fornecedor";
  data: string;
  fornecedorNome?: string;
  motivo: MotivoDevolucao;
  status: "processada";
  usuarioNome: string;
  observacao?: string;
  itens: DevolucaoItem[];
  totalItens: number;
  totalValor: number;
};

type Estado = Devolucao[];

let estado: Estado = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

function mapDevolucao(row: Record<string, unknown>, itens: DevolucaoItem[]): Devolucao {
  return {
    id: row.id as string,
    tipo: row.tipo as "cliente" | "fornecedor",
    data: row.data as string,
    fornecedorNome: (row.fornecedor_nome as string) || undefined,
    motivo: (row.motivo as MotivoDevolucao) ?? "outros",
    status: "processada",
    usuarioNome: (row.usuario_nome as string) ?? "Sistema",
    observacao: (row.observacao as string) || undefined,
    itens,
    totalItens: (row.total_itens as number) ?? 0,
    totalValor: (row.total_valor as number) ?? 0,
  };
}

async function carregar(lojaId: string) {
  const { data, error } = await supabase
    .from("devolucoes")
    .select("id, tipo, data, fornecedor_nome, motivo, status, usuario_nome, observacao, total_itens, total_valor, devolucao_itens(id, produto_id, produto_nome, qtd, preco_unitario)")
    .eq("loja_id", lojaId)
    .order("data", { ascending: false })
    .limit(200);
  if (error) { toast.error("Erro ao carregar devoluções"); return; }
  estado = (data ?? []).map((row) => {
    const itensRaw = (row.devolucao_itens as Record<string, unknown>[]) ?? [];
    const itens: DevolucaoItem[] = itensRaw.map((i) => ({
      id: i.id as string,
      devolucaoId: row.id as string,
      produtoId: i.produto_id as string,
      produtoNome: i.produto_nome as string,
      qtd: i.qtd as number,
      precoUnitario: i.preco_unitario as number,
    }));
    return mapDevolucao(row as Record<string, unknown>, itens);
  });
  notificar();
}

onLojaChange(async (lojaId) => {
  if (!lojaId) { estado = []; notificar(); return; }
  await carregar(lojaId);
});

export function useDevolicoes(): Devolucao[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export type NovaDevolicaoItem = { produtoId: string; produtoNome: string; qtd: number; precoUnitario: number };

export async function registrarDevolucao(params: {
  tipo: "cliente" | "fornecedor";
  motivo: MotivoDevolucao;
  fornecedorNome?: string;
  observacao?: string;
  usuarioNome?: string;
  itens: NovaDevolicaoItem[];
}): Promise<string | null> {
  const lojaId = getLojaId();
  if (!lojaId) { toast.error("Sessão não identificada"); return null; }
  if (params.itens.length === 0) { toast.error("Adicione ao menos um produto"); return null; }

  const totalItens = params.itens.reduce((s, i) => s + i.qtd, 0);
  const totalValor = params.itens.reduce((s, i) => s + i.qtd * i.precoUnitario, 0);

  // Persist devolucao
  const { data: devData, error: devErr } = await supabase
    .from("devolucoes")
    .insert({
      loja_id: lojaId,
      tipo: params.tipo,
      motivo: params.motivo,
      fornecedor_nome: params.fornecedorNome ?? null,
      observacao: params.observacao ?? null,
      usuario_nome: params.usuarioNome ?? "Sistema",
      total_itens: totalItens,
      total_valor: totalValor,
    })
    .select("id")
    .single();

  if (devErr || !devData) {
    toast.error("Erro ao registrar devolução: " + devErr?.message);
    return null;
  }

  const devolucaoId = devData.id as string;

  // Persist itens
  const { error: itensErr } = await supabase.from("devolucao_itens").insert(
    params.itens.map((i) => ({
      devolucao_id: devolucaoId,
      produto_id: i.produtoId,
      produto_nome: i.produtoNome,
      qtd: i.qtd,
      preco_unitario: i.precoUnitario,
    })),
  );
  if (itensErr) {
    toast.error("Erro ao salvar itens: " + itensErr.message);
    return null;
  }

  // Apply stock changes
  const gondola = estadoAtual().gondola;
  for (const item of params.itens) {
    const atual = gondola[item.produtoId] ?? 0;
    if (params.tipo === "cliente") {
      // Customer return → add back to gondola
      ajustarGondola(item.produtoId, atual + item.qtd, "Devolução de cliente");
    } else {
      // Return to supplier → remove from gondola
      ajustarGondola(item.produtoId, Math.max(0, atual - item.qtd), "Devolução ao fornecedor");
    }
  }

  // Audit
  const desc = params.tipo === "cliente"
    ? `Devolução de cliente: ${params.itens.length} item(s), ${totalItens} un. — motivo: ${params.motivo}`
    : `Devolução ao fornecedor${params.fornecedorNome ? ` "${params.fornecedorNome}"` : ""}: ${params.itens.length} item(s), ${totalItens} un. — motivo: ${params.motivo}`;
  gravarAudit({ acao: "ajuste", modulo: "Estoque", descricao: desc, usuarioNome: params.usuarioNome ?? "Sistema" });

  // Update local state optimistically
  const novaEntrada: Devolucao = {
    id: devolucaoId,
    tipo: params.tipo,
    data: new Date().toISOString(),
    fornecedorNome: params.fornecedorNome,
    motivo: params.motivo,
    status: "processada",
    usuarioNome: params.usuarioNome ?? "Sistema",
    observacao: params.observacao,
    itens: params.itens.map((i, idx) => ({ id: `tmp-${idx}`, devolucaoId, ...i })),
    totalItens,
    totalValor,
  };
  estado = [novaEntrada, ...estado];
  notificar();

  toast.success("Devolução registrada com sucesso");
  return devolucaoId;
}
