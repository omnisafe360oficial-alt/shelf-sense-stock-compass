import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import type { Produto, LocalDeposito, LocalGondola } from "./mock-data";

export type { LocalDeposito, LocalGondola };

let produtosCache: Produto[] = [];

export function getLocaisDeposito(): Record<string, LocalDeposito> {
  const result: Record<string, LocalDeposito> = {};
  for (const p of produtosCache) {
    if (p.localDeposito) result[p.id] = p.localDeposito;
  }
  return result;
}

export function getLocaisGondola(): Record<string, LocalGondola> {
  const result: Record<string, LocalGondola> = {};
  for (const p of produtosCache) {
    if (p.localGondola) result[p.id] = p.localGondola;
  }
  return result;
}

export type TarefaStatus = "pendente" | "em_andamento" | "concluida" | "inconsistencia";
export type TarefaPrioridade = "urgente" | "alta" | "normal";

export type TarefaReposicao = {
  id: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  categoria: string;
  qtdGondola: number;
  qtdDeposito: number;
  qtdMinima: number;
  qtdSugerida: number;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  criadaEm: string;
};

export type Reposicao = {
  id: string;
  data: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  operador: string;
  tarefaId?: string;
  qtdSistema: number;
  qtdContada: number;
  qtdReposta: number;
  bateu: boolean;
  diferenca: number;
};

type Estado = {
  tarefas: TarefaReposicao[];
  reposicoes: Reposicao[];
  carregando: boolean;
};

const VAZIO: Estado = { tarefas: [], reposicoes: [], carregando: false };
let estado: Estado = { ...VAZIO, carregando: true };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

function gerarTarefasIniciais(): TarefaReposicao[] {
  const agora = new Date().toISOString();
  return produtosCache.filter((p) => p.gondola <= p.minimo).map((p) => {
    const falta = p.minimo * 3 - p.gondola;
    const sugerida = Math.min(p.deposito, falta);
    const sem = p.deposito === 0;
    const baixo = p.gondola < p.minimo / 2;
    const prioridade: TarefaPrioridade = sem ? "urgente" : baixo ? "alta" : "normal";
    return {
      id: crypto.randomUUID(),
      produtoId: p.id,
      produtoNome: p.nome,
      produtoCodigo: p.codigo,
      categoria: p.categoria,
      qtdGondola: p.gondola,
      qtdDeposito: p.deposito,
      qtdMinima: p.minimo,
      qtdSugerida: sugerida,
      status: "pendente" as TarefaStatus,
      prioridade,
      criadaEm: agora,
    };
  });
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function mapTarefa(row: Record<string, unknown>): TarefaReposicao {
  return {
    id: row.id as string,
    produtoId: row.produto_id as string,
    produtoNome: row.produto_nome as string,
    produtoCodigo: row.produto_codigo as string,
    categoria: row.categoria as string,
    qtdGondola: row.qtd_gondola as number,
    qtdDeposito: row.qtd_deposito as number,
    qtdMinima: row.qtd_minima as number,
    qtdSugerida: row.qtd_sugerida as number,
    status: row.status as TarefaStatus,
    prioridade: row.prioridade as TarefaPrioridade,
    criadaEm: row.criada_em as string,
  };
}

function mapReposicao(row: Record<string, unknown>): Reposicao {
  return {
    id: row.id as string,
    data: row.data as string,
    produtoId: row.produto_id as string,
    produtoNome: row.produto_nome as string,
    produtoCodigo: row.produto_codigo as string,
    operador: row.operador as string,
    tarefaId: (row.tarefa_id as string) ?? undefined,
    qtdSistema: row.qtd_sistema as number,
    qtdContada: row.qtd_contada as number,
    qtdReposta: row.qtd_reposta as number,
    bateu: row.bateu as boolean,
    diferenca: row.diferenca as number,
  };
}

onLojaChange(async (lojaId) => {
  if (!lojaId) {
    produtosCache = [];
    emitir({ ...VAZIO });
    return;
  }
  emitir({ ...estado, carregando: true });

  const { data: prodsData } = await supabase
    .from("produtos")
    .select("id, nome, codigo, categoria, fornecedor_nome, preco_venda, minimo, validade_padrao_dias, local_deposito, local_gondola, lotes(qtd), gondola(qtd_gondola)")
    .eq("loja_id", lojaId)
    .order("nome");
  if (prodsData) {
    produtosCache = prodsData.map((row) => {
      const r = row as Record<string, unknown>;
      const lotes = (r.lotes as { qtd: number }[] | null) ?? [];
      const gon = (r.gondola as { qtd_gondola: number }[] | null) ?? [];
      return {
        id: r.id as string,
        nome: (r.nome as string) ?? "",
        codigo: (r.codigo as string) ?? "",
        categoria: (r.categoria as string) ?? "",
        fornecedor: (r.fornecedor_nome as string) ?? "",
        preco: (r.preco_venda as number) ?? 0,
        deposito: lotes.reduce((s, l) => s + (l.qtd ?? 0), 0),
        gondola: gon[0]?.qtd_gondola ?? 0,
        minimo: (r.minimo as number) ?? 0,
        validade: (r.validade_padrao_dias as unknown as string) ?? undefined,
        localDeposito: (r.local_deposito as Produto["localDeposito"]) ?? undefined,
        localGondola: (r.local_gondola as Produto["localGondola"]) ?? undefined,
      };
    });
  }

  const [tarefasRes, reposicoesRes] = await Promise.all([
    supabase.from("tarefas_reposicao").select("*").eq("loja_id", lojaId).order("criada_em"),
    supabase.from("reposicoes").select("*").eq("loja_id", lojaId).order("data", { ascending: false }).limit(200),
  ]);

  if (tarefasRes.error) toast.error("Erro ao carregar tarefas");
  if (reposicoesRes.error) toast.error("Erro ao carregar reposições");

  let tarefas = (tarefasRes.data ?? []).map(mapTarefa);
  const reposicoes = (reposicoesRes.data ?? []).map(mapReposicao);

  const temTarefasStale = tarefas.length > 0 && tarefas.some((t) => !isUUID(t.produtoId));

  if (tarefas.length === 0 || temTarefasStale) {
    if (temTarefasStale) {
      await supabase.from("tarefas_reposicao").delete().eq("loja_id", lojaId);
    }
    const iniciais = gerarTarefasIniciais();
    if (iniciais.length > 0) {
      const rows = iniciais.map((t) => ({
        id: t.id,
        loja_id: lojaId,
        produto_id: t.produtoId,
        produto_nome: t.produtoNome,
        produto_codigo: t.produtoCodigo,
        categoria: t.categoria,
        qtd_gondola: t.qtdGondola,
        qtd_deposito: t.qtdDeposito,
        qtd_minima: t.qtdMinima,
        qtd_sugerida: t.qtdSugerida,
        status: t.status,
        prioridade: t.prioridade,
      }));
      const { data: inseridas, error: errIns } = await supabase
        .from("tarefas_reposicao")
        .insert(rows)
        .select("*");
      if (errIns) {
        toast.error("Erro ao criar tarefas iniciais");
        tarefas = iniciais;
      } else {
        tarefas = (inseridas ?? []).map(mapTarefa);
      }
    } else {
      tarefas = [];
    }
  }

  emitir({ tarefas, reposicoes, carregando: false });
});

export function useRepositorEstado() {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
    () => estado,
  );
}

export function getRepositorEstado() {
  return estado;
}

export function registrarReposicao(rep: Omit<Reposicao, "id" | "data">): Reposicao {
  const lojaId = getLojaId();
  const id = crypto.randomUUID();
  const data = new Date().toISOString();
  const nova: Reposicao = { ...rep, id, data };

  let tarefas = estado.tarefas;
  if (rep.tarefaId) {
    tarefas = estado.tarefas.map((t) => {
      if (t.id !== rep.tarefaId) return t;
      return {
        ...t,
        status: (rep.bateu ? "concluida" : "inconsistencia") as TarefaStatus,
        qtdGondola: t.qtdGondola + rep.qtdReposta,
        qtdDeposito: Math.max(0, t.qtdDeposito - rep.qtdReposta),
      };
    });
  }
  emitir({ ...estado, tarefas, reposicoes: [nova, ...estado.reposicoes] });

  if (lojaId) {
    supabase.from("reposicoes").insert({
      id,
      loja_id: lojaId,
      data,
      produto_id: rep.produtoId,
      produto_nome: rep.produtoNome,
      produto_codigo: rep.produtoCodigo,
      operador: rep.operador,
      tarefa_id: rep.tarefaId ?? null,
      qtd_sistema: rep.qtdSistema,
      qtd_contada: rep.qtdContada,
      qtd_reposta: rep.qtdReposta,
      bateu: rep.bateu,
      diferenca: rep.diferenca,
    }).then(({ error }) => { if (error) toast.error("Erro ao salvar reposição: " + error.message); });

    if (rep.tarefaId) {
      const tarefa = tarefas.find((t) => t.id === rep.tarefaId);
      if (tarefa) {
        supabase.from("tarefas_reposicao").update({
          status: tarefa.status,
          qtd_gondola: tarefa.qtdGondola,
          qtd_deposito: tarefa.qtdDeposito,
          updated_at: new Date().toISOString(),
        }).eq("id", rep.tarefaId).then(({ error }) => {
          if (error) toast.error("Erro ao atualizar tarefa: " + error.message);
        });
      }
    }
  }

  return nova;
}

export function buscarPorCodigo(codigo: string): Produto | null {
  return produtosCache.find((p) => p.codigo === codigo.trim()) ?? null;
}

export function buscarPorId(id: string): Produto | null {
  return produtosCache.find((p) => p.id === id) ?? null;
}

export async function resetarTarefas() {
  const lojaId = getLojaId();
  if (lojaId) {
    await supabase.from("tarefas_reposicao").delete().eq("loja_id", lojaId);
    const iniciais = gerarTarefasIniciais();
    if (iniciais.length === 0) { emitir({ ...estado, tarefas: [] }); return; }
    const rows = iniciais.map((t) => ({
      id: t.id,
      loja_id: lojaId,
      produto_id: t.produtoId,
      produto_nome: t.produtoNome,
      produto_codigo: t.produtoCodigo,
      categoria: t.categoria,
      qtd_gondola: t.qtdGondola,
      qtd_deposito: t.qtdDeposito,
      qtd_minima: t.qtdMinima,
      qtd_sugerida: t.qtdSugerida,
      status: t.status,
      prioridade: t.prioridade,
    }));
    const { data: inseridas } = await supabase.from("tarefas_reposicao").insert(rows).select("*");
    emitir({ ...estado, tarefas: (inseridas ?? []).map(mapTarefa) });
  } else {
    emitir({ ...estado, tarefas: gerarTarefasIniciais() });
  }
}
