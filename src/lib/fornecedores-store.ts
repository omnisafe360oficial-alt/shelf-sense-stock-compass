import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Fornecedor } from "./mock-data";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { gravarAudit } from "./audit-store";

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

export function cadastrarFornecedor(dados: Omit<Fornecedor, "id">): string {
  const id = crypto.randomUUID();
  estado = [...estado, { ...dados, id }];
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    supabase
      .from("fornecedores")
      .insert({
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
      })
      .then(({ error }) => { if (error) toast.error("Erro ao salvar fornecedor: " + error.message); });
    gravarAudit({ modulo: "Fornecedores", acao: "cadastrar", descricao: `Fornecedor "${dados.nome}" cadastrado`, usuarioNome: "Sistema" });
  }
  return id;
}

export function excluirFornecedor(id: string): void {
  const fornecedor = estado.find((f) => f.id === id);
  estado = estado.filter((f) => f.id !== id);
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    supabase
      .from("fornecedores")
      .delete()
      .eq("id", id)
      .then(({ error }) => { if (error) toast.error("Erro ao excluir fornecedor: " + error.message); });
    gravarAudit({ modulo: "Fornecedores", acao: "excluir", descricao: `Fornecedor "${fornecedor?.nome ?? id}" excluído`, usuarioNome: "Sistema" });
  }
}

export function editarFornecedor(id: string, dados: Partial<Omit<Fornecedor, "id">>): void {
  estado = estado.map((f) => (f.id === id ? { ...f, ...dados } : f));
  notificar();
  const lojaId = getLojaId();
  if (lojaId) {
    const payload: Record<string, unknown> = {};
    if (dados.nome !== undefined) payload.nome = dados.nome;
    if (dados.cnpj !== undefined) payload.cnpj_cpf = dados.cnpj;
    if (dados.contato !== undefined) payload.contato = dados.contato;
    if (dados.telefone !== undefined) payload.telefone = dados.telefone;
    if (dados.email !== undefined) payload.email = dados.email;
    if (dados.cidade !== undefined) payload.cidade = dados.cidade;
    if (dados.prazo !== undefined) payload.prazo = dados.prazo;
    if (dados.whatsapp !== undefined) payload.whatsapp = dados.whatsapp;
    supabase
      .from("fornecedores")
      .update(payload)
      .eq("id", id)
      .then(({ error }) => { if (error) toast.error("Erro ao atualizar fornecedor: " + error.message); });
    const fAtual = estado.find((f) => f.id === id);
    gravarAudit({ modulo: "Fornecedores", acao: "editar", descricao: `Fornecedor "${fAtual?.nome ?? id}" atualizado`, usuarioNome: "Sistema" });
  }
}
