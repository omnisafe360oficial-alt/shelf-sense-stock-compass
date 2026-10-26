import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { produtos as CATALOGO } from "./mock-data";

export { CATALOGO as CATALOGO_REPOSITOR };

export type LocalDeposito = {
  rua: string;
  prateleira: string;
  nivel: number;
};

export type LocalGondola = {
  corredor: string;
  gondola: string;
  nivel: "Alto" | "Médio" | "Baixo";
  posicao: number;
};

export const LOCAIS_DEPOSITO: Record<string, LocalDeposito> = {
  "1": { rua: "R2", prateleira: "P3", nivel: 2 },
  "2": { rua: "R1", prateleira: "P1", nivel: 1 },
  "3": { rua: "R3", prateleira: "P2", nivel: 3 },
  "4": { rua: "R2", prateleira: "P4", nivel: 1 },
  "5": { rua: "R1", prateleira: "P2", nivel: 1 },
  "6": { rua: "R2", prateleira: "P3", nivel: 3 },
  "7": { rua: "R3", prateleira: "P1", nivel: 2 },
};

export const LOCAIS_GONDOLA: Record<string, LocalGondola> = {
  "1": { corredor: "A", gondola: "G2", nivel: "Médio", posicao: 3 },
  "2": { corredor: "B", gondola: "G1", nivel: "Baixo", posicao: 1 },
  "3": { corredor: "C", gondola: "G3", nivel: "Médio", posicao: 2 },
  "4": { corredor: "A", gondola: "G1", nivel: "Baixo", posicao: 4 },
  "5": { corredor: "B", gondola: "G2", nivel: "Baixo", posicao: 2 },
  "6": { corredor: "A", gondola: "G2", nivel: "Alto", posicao: 1 },
  "7": { corredor: "C", gondola: "G3", nivel: "Médio", posicao: 1 },
};

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
  return CATALOGO.filter((p) => p.gondola <= p.minimo).map((p) => {
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
  if (!lojaId) { emitir({ ...VAZIO }); return; }
  emitir({ ...estado, carregando: true });

  const [tarefasRes, reposicoesRes] = await Promise.all([
    supabase.from("tarefas_reposicao").select("*").eq("loja_id", lojaId).order("criada_em"),
    supabase.from("reposicoes").select("*").eq("loja_id", lojaId).order("data", { ascending: false }).limit(200),
  ]);

  if (tarefasRes.error) toast.error("Erro ao carregar tarefas");
  if (reposicoesRes.error) toast.error("Erro ao carregar reposições");

  let tarefas = (tarefasRes.data ?? []).map(mapTarefa);
  const reposicoes = (reposicoesRes.data ?? []).map(mapReposicao);

  if (tarefas.length === 0) {
    const iniciais = gerarTarefasIniciais();
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

export function buscarPorCodigo(codigo: string) {
  return CATALOGO.find((p) => p.codigo === codigo.trim()) ?? null;
}

export async function resetarTarefas() {
  const lojaId = getLojaId();
  if (lojaId) {
    await supabase.from("tarefas_reposicao").delete().eq("loja_id", lojaId);
    const iniciais = gerarTarefasIniciais();
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
