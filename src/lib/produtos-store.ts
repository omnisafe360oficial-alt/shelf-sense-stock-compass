import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Produto } from "./mock-data";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

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
    validade: (row.validade_padrao_dias as unknown as string) ?? undefined,
  };
}

onLojaChange(async (lojaId) => {
  if (!lojaId) {
    estado = [];
    notificar();
    return;
  }
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, codigo, categoria, fornecedor_nome, preco_venda, minimo, validade_padrao_dias, lotes(qtd), gondola(qtd_gondola)")
    .eq("loja_id", lojaId)
    .order("nome");
  if (error) { toast.error("Erro ao carregar produtos"); return; }
  estado = (data ?? []).map((row) => mapDoBanco(row as Record<string, unknown>));
  notificar();
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
      })
      .then(({ error }) => { if (error) toast.error("Erro ao salvar produto: " + error.message); });
  }
  return id;
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
    supabase
      .from("produtos")
      .update(payload)
      .eq("id", id)
      .then(({ error }) => { if (error) toast.error("Erro ao atualizar produto: " + error.message); });
  }
}
