import { useSyncExternalStore } from "react";
import { ajustarGondola, estadoAtual, executarTransferencia, registrarEntrada } from "@/lib/estoque-store";
import { carregar, salvar, CHAVE } from "./persist";

export type Inconsistencia = {
  id: string; data: string; origem: "Reposição" | "Recebimento"; produtoId: string;
  sistema: number; contado: number; referencia: string; usuario: string;
  status: "aberta" | "ajustada" | "mantida";
};
export type ItemNota = { produtoId: string; caixas: number; fator: number; embalagem: string; lote: string; validade: string };
export type Nota = { id: string; numero: string; fornecedor: string; chegada: string; itens: ItemNota[]; status: "aguardando" | "conferida" | "divergente" };
export type Conferencia = { id: string; data: string; produtoId: string; sistema: number; encontrado: number; reposto: number; usuario: string };

type Estado = { notas: Nota[]; inconsistencias: Inconsistencia[]; conferencias: Conferencia[] };

const SEED_OPERACAO: Estado = {
  notas: [
    { id: "n1", numero: "NF-e 48211", fornecedor: "Laticínios Serra Verde", chegada: "2026-10-22T14:10", status: "aguardando", itens: [
      { produtoId: "2", caixas: 10, fator: 12, embalagem: "Caixa c/ 12", lote: "SV1201", validade: "2026-12-05" },
      { produtoId: "5", caixas: 4, fator: 24, embalagem: "Caixa c/ 24", lote: "L2411B", validade: "2026-11-12" },
    ] },
    { id: "n2", numero: "NF-e 48230", fornecedor: "Distribuidora Camil", chegada: "2026-10-22T15:30", status: "aguardando", itens: [
      { produtoId: "7", caixas: 5, fator: 10, embalagem: "Fardo c/ 10", lote: "FJ1020", validade: "2027-04-20" },
      { produtoId: "3", caixas: 3, fator: 6, embalagem: "Fardo c/ 6", lote: "TJ1012", validade: "2027-09-30" },
    ] },
  ],
  inconsistencias: [
    { id: "i1", data: "2026-10-22T10:20", origem: "Reposição", produtoId: "6", sistema: 24, contado: 22, referencia: "Gôndola · Corredor 4", usuario: "Repositor · Pedro", status: "aberta" },
    { id: "i2", data: "2026-10-21T16:45", origem: "Recebimento", produtoId: "1", sistema: 144, contado: 132, referencia: "NF-e 48190", usuario: "Recebimento · João", status: "aberta" },
  ],
  conferencias: [
    { id: "c1", data: "2026-10-22T09:40", produtoId: "2", sistema: 6, encontrado: 6, reposto: 24, usuario: "Repositor · Pedro" },
  ],
};
let estado: Estado = carregar(CHAVE.operacao, SEED_OPERACAO);
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; salvar(CHAVE.operacao, estado); ouvintes.forEach((o) => o()); };
export function useOperacao() {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => estado, () => estado);
}
const agora = () => new Date().toISOString().slice(0, 16);

/** Converte a contagem (embalagens fechadas + unidades soltas) em unidades. */
export const emUnidades = (embalagens: number, fator: number, avulsas: number) => embalagens * fator + avulsas;

/** Compara o que a nota diz com o que foi contado (em unidades). */
export function compararNota(nota: Nota, contado: Record<string, number>) {
  return nota.itens.map((i) => {
    const esperado = i.caixas * i.fator;
    const c = contado[i.produtoId] ?? 0;
    return { produtoId: i.produtoId, esperado, contado: c, diferenca: c - esperado };
  });
}

/** Fecha a conferência cega: entra no depósito o que foi contado e abre inconsistência onde não bateu. */
export function conferirNota(notaId: string, contado: Record<string, number>, usuario: string) {
  const nota = estado.notas.find((n) => n.id === notaId);
  if (!nota || nota.status !== "aguardando") return [];
  const r = compararNota(nota, contado);
  nota.itens.forEach((i) => registrarEntrada(i.produtoId, contado[i.produtoId] ?? 0, i.lote, i.validade, nota.numero, usuario));
  const novas: Inconsistencia[] = r.filter((x) => x.diferenca !== 0).map((x, n) => ({
    id: `i${Date.now()}${n}`, data: agora(), origem: "Recebimento", produtoId: x.produtoId, sistema: x.esperado, contado: x.contado,
    referencia: nota.numero, usuario, status: "aberta",
  }));
  emitir({
    ...estado,
    notas: estado.notas.map((n) => (n.id === notaId ? { ...n, status: novas.length ? "divergente" : "conferida" } : n)),
    inconsistencias: [...novas, ...estado.inconsistencias],
  });
  return novas;
}

/** Repositor contou a gôndola sem ver o sistema e repôs. Se não bater, abre inconsistência. */
export function conferirReposicao(produtoId: string, encontrado: number, reposto: number, usuario: string) {
  const sistema = estadoAtual().gondola[produtoId] ?? 0;
  if (reposto > 0) executarTransferencia(produtoId, reposto);
  const conf: Conferencia = { id: `c${Date.now()}`, data: agora(), produtoId, sistema, encontrado, reposto, usuario };
  const nova: Inconsistencia[] = encontrado === sistema ? [] : [{
    id: `i${Date.now()}`, data: agora(), origem: "Reposição", produtoId, sistema, contado: encontrado,
    referencia: "Gôndola", usuario, status: "aberta",
  }];
  emitir({ ...estado, conferencias: [conf, ...estado.conferencias], inconsistencias: [...nova, ...estado.inconsistencias] });
  return nova.length === 0;
}

/** Resolve: "ajustar" aceita a contagem (só gôndola); "manter" mantém o número do sistema. */
export function resolverInconsistencia(id: string, acao: "ajustar" | "manter") {
  const inc = estado.inconsistencias.find((i) => i.id === id);
  if (!inc || inc.status !== "aberta") return;
  if (acao === "ajustar" && inc.origem === "Reposição") {
    const atual = estadoAtual().gondola[inc.produtoId] ?? 0;
    ajustarGondola(inc.produtoId, Math.max(0, atual + (inc.contado - inc.sistema)), "Ajuste de inconsistência");
  }
  emitir({ ...estado, inconsistencias: estado.inconsistencias.map((i) => (i.id === id ? { ...i, status: acao === "ajustar" ? "ajustada" : "mantida" } : i)) });
}
