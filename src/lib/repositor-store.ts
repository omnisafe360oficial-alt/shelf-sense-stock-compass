import { useSyncExternalStore } from "react";
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
};

function gerarTarefasIniciais(): TarefaReposicao[] {
  const agora = new Date().toISOString();
  return CATALOGO.filter((p) => p.gondola <= p.minimo).map((p) => {
    const falta = p.minimo * 3 - p.gondola;
    const sugerida = Math.min(p.deposito, falta);
    const sem = p.deposito === 0;
    const baixo = p.gondola < p.minimo / 2;
    const prioridade: TarefaPrioridade = sem ? "urgente" : baixo ? "alta" : "normal";
    return {
      id: `t_${p.id}`,
      produtoId: p.id,
      produtoNome: p.nome,
      produtoCodigo: p.codigo,
      categoria: p.categoria,
      qtdGondola: p.gondola,
      qtdDeposito: p.deposito,
      qtdMinima: p.minimo,
      qtdSugerida: sugerida,
      status: "pendente",
      prioridade,
      criadaEm: agora,
    };
  });
}

const TAREFAS_INICIAIS = gerarTarefasIniciais();

function carregarEstado(): Estado {
  try {
    const salvo = localStorage.getItem("omnisafe_repositor_v1");
    if (salvo) {
      const parsed = JSON.parse(salvo) as Partial<Estado>;
      return {
        tarefas: parsed.tarefas ?? TAREFAS_INICIAIS,
        reposicoes: parsed.reposicoes ?? [],
      };
    }
  } catch {}
  return { tarefas: TAREFAS_INICIAIS, reposicoes: [] };
}

function salvarEstado(e: Estado) {
  try {
    localStorage.setItem("omnisafe_repositor_v1", JSON.stringify(e));
  } catch {}
}

let estado: Estado = carregarEstado();
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => {
  estado = n;
  salvarEstado(n);
  ouvintes.forEach((o) => o());
};

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

export function registrarReposicao(rep: Omit<Reposicao, "id" | "data">) {
  const nova: Reposicao = { ...rep, id: crypto.randomUUID(), data: new Date().toISOString() };
  let tarefas = estado.tarefas;
  if (rep.tarefaId) {
    tarefas = estado.tarefas.map((t) => {
      if (t.id !== rep.tarefaId) return t;
      const novoStatus: TarefaStatus = rep.bateu ? "concluida" : "inconsistencia";
      return {
        ...t,
        status: novoStatus,
        qtdGondola: t.qtdGondola + rep.qtdReposta,
        qtdDeposito: Math.max(0, t.qtdDeposito - rep.qtdReposta),
      };
    });
  }
  emitir({ tarefas, reposicoes: [nova, ...estado.reposicoes] });
  return nova;
}

export function buscarPorCodigo(codigo: string) {
  return CATALOGO.find((p) => p.codigo === codigo.trim()) ?? null;
}

export function resetarTarefas() {
  emitir({ ...estado, tarefas: gerarTarefasIniciais() });
}
