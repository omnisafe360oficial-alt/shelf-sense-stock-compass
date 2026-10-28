import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

export type AuditEntry = {
  id: string;
  data: string;
  acao: string;
  modulo: string;
  descricao: string;
  usuarioNome: string;
  produtoId?: string;
  produtoNome?: string;
  valorAnterior?: string;
  valorNovo?: string;
};

let estado: AuditEntry[] = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

function mapRow(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string,
    data: r.data as string,
    acao: r.acao as string,
    modulo: r.modulo as string,
    descricao: r.descricao as string,
    usuarioNome: (r.usuario_nome as string) ?? "",
    produtoId: (r.produto_id as string) ?? undefined,
    produtoNome: (r.produto_nome as string) ?? undefined,
    valorAnterior: (r.valor_anterior as string) ?? undefined,
    valorNovo: (r.valor_novo as string) ?? undefined,
  };
}

onLojaChange(async (lojaId) => {
  if (!lojaId) { estado = []; notificar(); return; }
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("loja_id", lojaId)
    .order("data", { ascending: false })
    .limit(500);
  if (error) { toast.error("Erro ao carregar log de auditoria"); return; }
  estado = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  notificar();
});

export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
    () => estado,
  );
}

export function gravarAudit(entrada: Omit<AuditEntry, "id" | "data">) {
  const lojaId = getLojaId();
  if (!lojaId) return;

  const novaEntrada: AuditEntry = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    ...entrada,
  };

  estado = [novaEntrada, ...estado];
  notificar();

  supabase
    .from("audit_log")
    .insert({
      id: novaEntrada.id,
      loja_id: lojaId,
      data: novaEntrada.data,
      acao: novaEntrada.acao,
      modulo: novaEntrada.modulo,
      descricao: novaEntrada.descricao,
      usuario_nome: novaEntrada.usuarioNome,
      produto_id: novaEntrada.produtoId ?? null,
      produto_nome: novaEntrada.produtoNome ?? null,
      valor_anterior: novaEntrada.valorAnterior ?? null,
      valor_novo: novaEntrada.valorNovo ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("Erro ao gravar auditoria:", error.message);
    });
}
