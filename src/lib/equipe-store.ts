import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange } from "./loja-resolver";
import { gravarAudit } from "./audit-store";

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
  const membro = estado.find((m) => m.id === id);
  const papelAnterior = membro?.papel;
  estado = estado.map((m) => (m.id === id ? { ...m, papel } : m));
  notificar();
  supabase
    .from("membros")
    .update({ papel })
    .eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Erro ao alterar papel: " + error.message);
      else gravarAudit({ acao: "editar", modulo: "Equipe", descricao: `Papel de "${membro?.nome ?? id}" alterado de "${papelAnterior}" para "${papel}".`, usuarioNome: "Sistema", valorAnterior: papelAnterior, valorNovo: papel });
    });
}

export function alterarStatus(id: string, ativo: boolean): void {
  const membro = estado.find((m) => m.id === id);
  estado = estado.map((m) => (m.id === id ? { ...m, ativo } : m));
  notificar();
  supabase
    .from("membros")
    .update({ status: ativo ? "ativo" : "inativo" })
    .eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Erro ao alterar status: " + error.message);
      else gravarAudit({ acao: "editar", modulo: "Equipe", descricao: `Membro "${membro?.nome ?? id}" ${ativo ? "ativado" : "bloqueado"}.`, usuarioNome: "Sistema" });
    });
}

export function removerMembro(id: string): void {
  const membro = estado.find((m) => m.id === id);
  estado = estado.filter((m) => m.id !== id);
  notificar();
  supabase
    .from("membros")
    .delete()
    .eq("id", id)
    .then(({ error }) => {
      if (error) {
        if (membro) { estado = [...estado, membro]; notificar(); }
        toast.error("Erro ao remover membro: " + error.message);
      } else {
        gravarAudit({ acao: "excluir", modulo: "Equipe", descricao: `Membro "${membro?.nome ?? id}" removido permanentemente.`, usuarioNome: "Sistema" });
      }
    });
}
