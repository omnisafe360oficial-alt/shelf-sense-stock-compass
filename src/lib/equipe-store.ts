import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange } from "./loja-resolver";

export const PAPEIS = {
  Proprietário: "Acesso a tudo",
  Gerente: "Tudo, menos configurações da loja",
  Caixa: "Somente o PDV",
  Repositor: "App do repositor e gôndola",
  Recebimento: "App de recebimento (conferência cega)",
} as const;
export type Papel = keyof typeof PAPEIS;

export type Membro = { id: string; nome: string; email: string; papel: Papel; ativo: boolean };

let estado: Membro[] = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

function mapDoBanco(row: Record<string, unknown>): Membro {
  return {
    id: row.id as string,
    nome: (row.nome as string) ?? "",
    email: (row.email as string) ?? "",
    papel: (row.papel as Papel) ?? "Caixa",
    ativo: row.status === "ativo",
  };
}

onLojaChange(async (lojaId) => {
  if (!lojaId) {
    estado = [];
    notificar();
    return;
  }
  const { data, error } = await supabase
    .from("membros")
    .select("id, nome, email, papel, status")
    .eq("loja_id", lojaId)
    .order("nome");
  if (error) { toast.error("Erro ao carregar equipe"); return; }
  estado = (data ?? []).map(mapDoBanco);
  notificar();
});

export function useEquipe(): Membro[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getEquipe(): Membro[] { return estado; }

export function alterarPapel(id: string, papel: Papel): void {
  estado = estado.map((m) => (m.id === id ? { ...m, papel } : m));
  notificar();
  supabase
    .from("membros")
    .update({ papel })
    .eq("id", id)
    .then(({ error }) => { if (error) toast.error("Erro ao alterar papel: " + error.message); });
}

export function alterarStatus(id: string, ativo: boolean): void {
  estado = estado.map((m) => (m.id === id ? { ...m, ativo } : m));
  notificar();
  supabase
    .from("membros")
    .update({ status: ativo ? "ativo" : "inativo" })
    .eq("id", id)
    .then(({ error }) => { if (error) toast.error("Erro ao alterar status: " + error.message); });
}
