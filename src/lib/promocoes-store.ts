import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { getLojaId, onLojaChange } from "./loja-resolver";
import { gravarAudit } from "./audit-store";

export type TipoDesconto = "pct" | "fixo";

export type Promocao = {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoDesconto;
  valor: number;
  dataInicio: string;
  dataFim: string;
  todos: boolean;
  produtoIds: string[];
};

type Estado = { promocoes: Promocao[] };

const VAZIO: Estado = { promocoes: [] };
let estado: Estado = { ...VAZIO };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

function mapRow(r: Record<string, unknown>): Promocao {
  return {
    id: r.id as string,
    nome: (r.nome as string) ?? "",
    descricao: (r.descricao as string) ?? "",
    tipo: (r.tipo as TipoDesconto) ?? "pct",
    valor: Number(r.valor ?? 0),
    dataInicio: (r.data_inicio as string) ?? "",
    dataFim: (r.data_fim as string) ?? "",
    todos: Boolean(r.todos),
    produtoIds: (r.produto_ids as string[]) ?? [],
  };
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function carregar(lojaId: string) {
  const { data, error } = await supabase
    .from("promocoes")
    .select("id, nome, descricao, tipo, valor, data_inicio, data_fim, todos, produto_ids")
    .eq("loja_id", lojaId)
    .order("data_inicio");
  if (error) { toast.error("Erro ao carregar promoções"); return; }
  emitir({ promocoes: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)) });
}

onLojaChange(async (lojaId) => {
  if (realtimeChannel) { await supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (!lojaId) { emitir({ ...VAZIO }); return; }
  await carregar(lojaId);
  realtimeChannel = supabase
    .channel(`promocoes-${lojaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "promocoes", filter: `loja_id=eq.${lojaId}` }, () => carregar(lojaId))
    .subscribe();
});

export function usePromocoes() {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function addPromocao(p: Omit<Promocao, "id">): void {
  const id = crypto.randomUUID();
  emitir({ promocoes: [...estado.promocoes, { ...p, id }] });
  const lojaId = getLojaId();
  if (!lojaId) return;
  supabase
    .from("promocoes")
    .insert({ id, loja_id: lojaId, nome: p.nome, descricao: p.descricao, tipo: p.tipo, valor: p.valor, data_inicio: p.dataInicio, data_fim: p.dataFim, todos: p.todos, produto_ids: p.produtoIds })
    .then(({ error }) => {
      if (error) toast.error("Erro ao criar promoção: " + error.message);
      else gravarAudit({ acao: "criar", modulo: "Promoções", descricao: `Promoção "${p.nome}" criada.`, usuarioNome: "Sistema" });
    });
}

export function updatePromocao(parcial: Partial<Promocao> & { id: string }): void {
  emitir({ promocoes: estado.promocoes.map((p) => p.id === parcial.id ? { ...p, ...parcial } : p) });
  const lojaId = getLojaId();
  if (!lojaId) return;
  const payload: Record<string, unknown> = {};
  if (parcial.nome !== undefined) payload.nome = parcial.nome;
  if (parcial.descricao !== undefined) payload.descricao = parcial.descricao;
  if (parcial.tipo !== undefined) payload.tipo = parcial.tipo;
  if (parcial.valor !== undefined) payload.valor = parcial.valor;
  if (parcial.dataInicio !== undefined) payload.data_inicio = parcial.dataInicio;
  if (parcial.dataFim !== undefined) payload.data_fim = parcial.dataFim;
  if (parcial.todos !== undefined) payload.todos = parcial.todos;
  if (parcial.produtoIds !== undefined) payload.produto_ids = parcial.produtoIds;
  const nome = estado.promocoes.find((p) => p.id === parcial.id)?.nome ?? parcial.id;
  supabase.from("promocoes").update(payload).eq("id", parcial.id)
    .then(({ error }) => {
      if (error) toast.error("Erro ao atualizar promoção: " + error.message);
      else gravarAudit({ acao: "editar", modulo: "Promoções", descricao: `Promoção "${nome}" atualizada.`, usuarioNome: "Sistema" });
    });
}

export function removePromocao(id: string): void {
  const nome = estado.promocoes.find((p) => p.id === id)?.nome ?? id;
  emitir({ promocoes: estado.promocoes.filter((p) => p.id !== id) });
  const lojaId = getLojaId();
  if (!lojaId) return;
  supabase.from("promocoes").delete().eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Erro ao excluir promoção: " + error.message);
      else gravarAudit({ acao: "excluir", modulo: "Promoções", descricao: `Promoção "${nome}" excluída.`, usuarioNome: "Sistema" });
    });
}

export function getPromocoes(): Promocao[] { return estado.promocoes; }

export function promocaoAtivaParaProduto(
  promocoes: Promocao[],
  produtoId: string,
  hoje: string,
): Promocao | null {
  return (
    promocoes.find(
      (p) =>
        p.dataInicio <= hoje &&
        p.dataFim >= hoje &&
        (p.todos || p.produtoIds.includes(produtoId)),
    ) ?? null
  );
}
