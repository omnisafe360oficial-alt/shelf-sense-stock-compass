import { useSyncExternalStore } from "react";
import { produtos } from "@/lib/mock-data";

export type Lote = { id: string; produtoId: string; lote: string; validade: string; qtd: number; local: string };
export type Mov = { id: string; data: string; tipo: "entrada" | "transferencia" | "venda" | "ajuste"; produtoId: string; lote?: string; qtd: number; origem: string; destino: string; usuario: string };

type Estado = { lotes: Lote[]; gondola: Record<string, number>; movs: Mov[] };

let estado: Estado = {
  lotes: [
    { id: "l1", produtoId: "1", lote: "LX2504", validade: "2027-03-10", qtd: 96, local: "C1 · P2" },
    { id: "l2", produtoId: "1", lote: "LX2610", validade: "2027-08-10", qtd: 144, local: "C1 · P2" },
    { id: "l3", produtoId: "2", lote: "SV1022", validade: "2026-10-30", qtd: 60, local: "Câmara fria" },
    { id: "l4", produtoId: "2", lote: "SV1105", validade: "2026-11-20", qtd: 120, local: "Câmara fria" },
    { id: "l5", produtoId: "3", lote: "TJ0901", validade: "2027-05-01", qtd: 60, local: "C3 · P1" },
    { id: "l6", produtoId: "4", lote: "YP3320", validade: "2028-01-15", qtd: 300, local: "C4 · P3" },
    { id: "l7", produtoId: "5", lote: "L2310A", validade: "2026-10-23", qtd: 36, local: "Câmara fria" },
    { id: "l8", produtoId: "6", lote: "SD7781", validade: "2028-03-02", qtd: 72, local: "C1 · P4" },
    { id: "l9", produtoId: "5", lote: "L2309C", validade: "2026-10-19", qtd: 8, local: "Câmara fria" },
    { id: "l10", produtoId: "3", lote: "TJ0815", validade: "2026-11-04", qtd: 14, local: "C3 · P1" },
  ],
  gondola: Object.fromEntries(produtos.map((p) => [p.id, p.gondola])),
  movs: [
    { id: "m1", data: "2026-10-22T08:12", tipo: "entrada", produtoId: "1", lote: "LX2610", qtd: 144, origem: "NF-e 48190", destino: "Depósito", usuario: "Recebimento · João" },
    { id: "m2", data: "2026-10-22T09:40", tipo: "transferencia", produtoId: "2", lote: "SV1022", qtd: 24, origem: "Depósito", destino: "Gôndola", usuario: "Repositor · Pedro" },
    { id: "m3", data: "2026-10-22T11:05", tipo: "venda", produtoId: "1", qtd: 10, origem: "Gôndola", destino: "PDV · Caixa 2", usuario: "Caixa · Luana" },
    { id: "m4", data: "2026-10-22T12:30", tipo: "ajuste", produtoId: "3", lote: "TJ0901", qtd: -2, origem: "Depósito", destino: "Perda (avaria)", usuario: "Maria Souza" },
    { id: "m5", data: "2026-10-22T13:15", tipo: "venda", produtoId: "2", qtd: 18, origem: "Gôndola", destino: "PDV · Caixa 1", usuario: "Caixa · Rafael" },
  ],
};
const ouvintes = new Set<() => void>();
const emitir = (novo: Estado) => { estado = novo; ouvintes.forEach((o) => o()); };

export function useEstoque() {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => estado, () => estado);
}

/** Lotes do produto em ordem de saída: o que vence primeiro sai primeiro. */
export const lotesFefo = (s: Estado, produtoId: string) =>
  s.lotes.filter((l) => l.produtoId === produtoId && l.qtd > 0).sort((a, b) => a.validade.localeCompare(b.validade));

/** Transfere do depósito para a gôndola consumindo lotes por vencimento. Retorna o que foi movido. */
export function transferir(s: Estado, produtoId: string, qtd: number): { estado: Estado; movidos: { lote: string; qtd: number }[] } {
  const disponivel = lotesFefo(s, produtoId).reduce((t, l) => t + l.qtd, 0);
  if (qtd <= 0 || qtd > disponivel) throw new Error(`Quantidade indisponível no depósito (máx. ${disponivel}).`);
  let falta = qtd;
  const movidos: { lote: string; qtd: number }[] = [];
  const ordem = lotesFefo(s, produtoId).map((l) => l.id);
  const lotes = s.lotes.map((l) => ({ ...l }));
  for (const id of ordem) {
    const l = lotes.find((x) => x.id === id)!;
    const tira = Math.min(l.qtd, falta);
    l.qtd -= tira; falta -= tira; movidos.push({ lote: l.lote, qtd: tira });
    if (!falta) break;
  }
  const agora = new Date().toISOString().slice(0, 16);
  const movs: Mov[] = [
    ...movidos.map((m, i) => ({ id: `m${Date.now()}${i}`, data: agora, tipo: "transferencia" as const, produtoId, lote: m.lote, qtd: m.qtd, origem: "Depósito", destino: "Gôndola", usuario: "Maria Souza" })),
    ...s.movs,
  ];
  return { estado: { lotes, gondola: { ...s.gondola, [produtoId]: (s.gondola[produtoId] ?? 0) + qtd }, movs }, movidos };
}

export function executarTransferencia(produtoId: string, qtd: number) {
  const r = transferir(estado, produtoId, qtd);
  emitir(r.estado);
  return r.movidos;
}

export const diasAte = (iso: string, hoje = new Date("2026-10-22")) => Math.round((new Date(iso).getTime() - hoje.getTime()) / 86400000);

export type Faixa = "vencido" | "7" | "15" | "30" | "ok";
export function faixaValidade(dias: number): Faixa {
  if (dias < 0) return "vencido";
  if (dias <= 7) return "7";
  if (dias <= 15) return "15";
  if (dias <= 30) return "30";
  return "ok";
}

/** Dá baixa no lote inteiro como perda (vencido/avariado) e registra no histórico. */
export function registrarPerda(loteId: string, motivo: string) {
  const l = estado.lotes.find((x) => x.id === loteId);
  if (!l || l.qtd <= 0) return;
  const mov: Mov = { id: `m${Date.now()}`, data: new Date().toISOString().slice(0, 16), tipo: "ajuste", produtoId: l.produtoId, lote: l.lote, qtd: -l.qtd, origem: "Depósito", destino: `Perda (${motivo})`, usuario: "Maria Souza" };
  emitir({ ...estado, lotes: estado.lotes.map((x) => (x.id === loteId ? { ...x, qtd: 0 } : x)), movs: [mov, ...estado.movs] });
}

export type ItemVenda = { produtoId: string; qtd: number };

/** Fecha a venda: desconta da gôndola e registra no histórico. Retorna produtos que chegaram ao mínimo. */
export function vender(s: Estado, itens: ItemVenda[], caixa: string, minimos: Record<string, number>): { estado: Estado; repor: string[] } {
  if (!itens.length) throw new Error("Nenhum item na venda.");
  const gondola = { ...s.gondola };
  for (const i of itens) {
    if (i.qtd <= 0) throw new Error("Quantidade inválida.");
    if ((gondola[i.produtoId] ?? 0) < i.qtd) throw new Error("Quantidade maior que a gôndola.");
    gondola[i.produtoId] -= i.qtd;
  }
  const agora = new Date().toISOString().slice(0, 16);
  const novos: Mov[] = itens.map((i, n) => ({ id: `v${Date.now()}${n}`, data: agora, tipo: "venda", produtoId: i.produtoId, qtd: i.qtd, origem: "Gôndola", destino: `PDV · ${caixa}`, usuario: `Caixa · ${caixa}` }));
  const repor = itens.filter((i) => gondola[i.produtoId] <= (minimos[i.produtoId] ?? 0) && (s.gondola[i.produtoId] ?? 0) > (minimos[i.produtoId] ?? 0)).map((i) => i.produtoId);
  return { estado: { ...s, gondola, movs: [...novos, ...s.movs] }, repor };
}

export function fecharVenda(itens: ItemVenda[], caixa: string, minimos: Record<string, number>) {
  const r = vender(estado, itens, caixa, minimos);
  emitir(r.estado);
  return r.repor;
}
