import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Fornecedor } from "./mock-data";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

let estado: Fornecedor[] = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

function mapDoBanco(row: Record<string, unknown>): Fornecedor {
  return {
    id: row.id as string,
    nome: (row.nome as string) ?? "",
    cnpj: (row.cnpj_cpf as string) ?? "",
    contato: (row.contato as string) ?? "",
    telefone: (row.telefone as string) ?? "",
    email: (row.email as string) ?? "",
    cidade: (row.cidade as string) ?? "",
    prazo: (row.prazo as string) ?? "",
    whatsapp: (row.whatsapp as string) ?? "",
  };
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function carregarFornecedores(lojaId: string) {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome, cnpj_cpf, contato, telefone, email, cidade, prazo, whatsapp")
    .eq("loja_id", lojaId)
    .order("nome");
  if (error) { toast.error("Erro ao carregar fornecedores"); return; }
  estado = (data ?? []).map(mapDoBanco);
  notificar();
}

onLojaChange(async (lojaId) => {
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (!lojaId) { estado = []; notificar(); return; }

  await carregarFornecedores(lojaId);

  realtimeChannel = supabase
    .channel(`fornecedores-${lojaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "fornecedores", filter: `loja_id=eq.${lojaId}` }, () => {
      carregarFornecedores(lojaId);
    })
    .subscribe();
});

export function useFornecedores(): Fornecedor[] {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getFornecedores(): Fornecedor[] { return estado; }

export const SEM_LOJA = "Sua conta não está ligada a uma loja. Termine a configuração da loja.";

function exigirLoja(): string {
  const lojaId = getLojaId();
  if (!lojaId) throw new Error(SEM_LOJA);
  return lojaId;
}

/** Salva no banco e só devolve o id depois que o banco confirmar. */
export async function cadastrarFornecedor(dados: Omit<Fornecedor, "id">): Promise<string> {
  const lojaId = exigirLoja();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("fornecedores").insert({
    id,
    loja_id: lojaId,
    nome: dados.nome,
    cnpj_cpf: dados.cnpj,
    contato: dados.contato,
    telefone: dados.telefone,
    email: dados.email,
    cidade: dados.cidade,
    prazo: dados.prazo,
    whatsapp: dados.whatsapp ?? null,
  });
  if (error) throw new Error("O banco não aceitou o fornecedor: " + error.message);
  await carregarFornecedores(lojaId);
  return id;
}

export async function excluirFornecedor(id: string): Promise<void> {
  const lojaId = exigirLoja();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) {
    toast.error("Erro ao excluir fornecedor: " + error.message, { duration: 10000 });
    throw error;
  }
  await carregarFornecedores(lojaId);
}

export async function editarFornecedor(id: string, dados: Partial<Omit<Fornecedor, "id">>): Promise<void> {
  const lojaId = exigirLoja();
  const payload: Record<string, unknown> = {};
  if (dados.nome !== undefined) payload.nome = dados.nome;
  if (dados.cnpj !== undefined) payload.cnpj_cpf = dados.cnpj;
  if (dados.contato !== undefined) payload.contato = dados.contato;
  if (dados.telefone !== undefined) payload.telefone = dados.telefone;
  if (dados.email !== undefined) payload.email = dados.email;
  if (dados.cidade !== undefined) payload.cidade = dados.cidade;
  if (dados.prazo !== undefined) payload.prazo = dados.prazo;
  if (dados.whatsapp !== undefined) payload.whatsapp = dados.whatsapp;
  const { error } = await supabase.from("fornecedores").update(payload).eq("id", id);
  if (error) {
    toast.error("Erro ao atualizar fornecedor: " + error.message, { duration: 10000 });
    throw error;
  }
  await carregarFornecedores(lojaId);
}

/** Mostra o erro na tela por tempo suficiente; se faltar a loja, oferece o atalho. */
export function avisarErroFornecedor(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === SEM_LOJA) {
    toast.error(SEM_LOJA, {
      duration: 15000,
      action: { label: "Configurar loja", onClick: () => { window.location.href = "/configurar-loja"; } },
    });
  } else {
    toast.error(msg, { duration: 15000 });
  }
}
