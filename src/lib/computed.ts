import { diasAte, faixaValidade, type Faixa, type Lote, type Mov } from "./estoque-store";
import { getProdutos } from "./produtos-store";
import { type Produto } from "./mock-data";

export const HOJE = "2026-10-22";
const ONTEM = "2026-10-21";

export function vendasPorProduto(movs: Mov[]): Record<string, { un: number; ultimaData: string | null }> {
  const map: Record<string, { un: number; ultimaData: string | null }> = {};
  for (const m of movs) {
    if (m.tipo !== "venda") continue;
    if (!map[m.produtoId]) map[m.produtoId] = { un: 0, ultimaData: null };
    map[m.produtoId].un += m.qtd;
    if (!map[m.produtoId].ultimaData || m.data > map[m.produtoId].ultimaData!) {
      map[m.produtoId].ultimaData = m.data;
    }
  }
  return map;
}

export function diasSemVenda(ultimaData: string | null): number {
  if (!ultimaData) return 999;
  const diff = new Date(HOJE).getTime() - new Date(ultimaData.slice(0, 10)).getTime();
  return Math.round(diff / 86_400_000);
}

export function vendasHoje(movs: Mov[]): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.startsWith(HOJE))
    .reduce((s, m) => s + m.qtd * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export function vendasOntem(movs: Mov[]): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.startsWith(ONTEM))
    .reduce((s, m) => s + m.qtd * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

/** Retorna array de 12 valores (R$) para as horas 8h–19h do dia de hoje. */
export function vendasPorHora(movs: Mov[]): number[] {
  const hours = Array.from<number>({ length: 12 }).fill(0);
  for (const m of movs) {
    if (m.tipo !== "venda" || !m.data.startsWith(HOJE)) continue;
    const h = parseInt(m.data.slice(11, 13), 10);
    const idx = h - 8;
    if (idx >= 0 && idx < 12) {
      hours[idx] += m.qtd * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0);
    }
  }
  return hours;
}

export function abaixoDoMinimo(gondola: Record<string, number>): Produto[] {
  return getProdutos()
    .filter((p) => (gondola[p.id] ?? 0) <= p.minimo)
    .sort((a, b) => (gondola[a.id] ?? 0) / a.minimo - (gondola[b.id] ?? 0) / b.minimo);
}

export type LoteInfo = Lote & { produto: Produto; dias: number; faixa: Faixa };

export function lotesVencendo(lotes: Lote[], limiar: 7 | 15 | 30 = 15): LoteInfo[] {
  return lotes
    .filter((l) => l.qtd > 0)
    .map((l) => {
      const dias = diasAte(l.validade);
      const produto = getProdutos().find((p) => p.id === l.produtoId)!;
      return { ...l, produto, dias, faixa: faixaValidade(dias) };
    })
    .filter((l) => l.dias <= limiar)
    .sort((a, b) => a.dias - b.dias);
}
