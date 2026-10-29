import { diasAte, faixaValidade, type Faixa, type Lote, type Mov } from "./estoque-store";
import { getProdutos } from "./produtos-store";
import { type Produto } from "./mock-data";

export const HOJE = new Date().toISOString().slice(0, 10);
const ONTEM = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export function vendasPorProduto(movs: Mov[]): Record<string, { un: number; ultimaData: string | null }> {
  const map: Record<string, { un: number; ultimaData: string | null }> = {};
  for (const m of movs) {
    if (m.tipo !== "venda") continue;
    if (!map[m.produtoId]) map[m.produtoId] = { un: 0, ultimaData: null };
    map[m.produtoId].un += Math.abs(m.qtd);
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
    .reduce((s, m) => s + Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export function vendasOntem(movs: Mov[]): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.startsWith(ONTEM))
    .reduce((s, m) => s + Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

/** Retorna array de 12 valores (R$) para as horas 8h–19h do dia de hoje. */
export function vendasPorHora(movs: Mov[]): number[] {
  const hours = Array.from<number>({ length: 12 }).fill(0);
  for (const m of movs) {
    if (m.tipo !== "venda" || !m.data.startsWith(HOJE)) continue;
    const h = parseInt(m.data.slice(11, 13), 10);
    const idx = h - 8;
    if (idx >= 0 && idx < 12) {
      hours[idx] += Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0);
    }
  }
  return hours;
}

export function abaixoDoMinimo(gondola: Record<string, number>): Produto[] {
  return getProdutos()
    .filter((p) => (gondola[p.id] ?? 0) <= p.minimo)
    .sort((a, b) => (gondola[a.id] ?? 0) / a.minimo - (gondola[b.id] ?? 0) / b.minimo);
}

export function abaixoDoMinimoDeposito(lotes: Lote[]): Produto[] {
  const totais: Record<string, number> = {};
  for (const l of lotes) {
    if (l.qtd > 0) totais[l.produtoId] = (totais[l.produtoId] ?? 0) + l.qtd;
  }
  const min = (p: Produto) => p.minimoDeposito ?? 10;
  return getProdutos()
    .filter((p) => (totais[p.id] ?? 0) <= min(p))
    .sort((a, b) => (totais[a.id] ?? 0) / min(a) - (totais[b.id] ?? 0) / min(b));
}

export type LoteInfo = Lote & { produto: Produto; dias: number; faixa: Faixa };

export function lotesVencendo(lotes: Lote[], limiar: number = 15): LoteInfo[] {
  return lotes
    .filter((l) => l.qtd > 0)
    .flatMap((l) => {
      const produto = getProdutos().find((p) => p.id === l.produtoId);
      if (!produto) return [];
      const dias = diasAte(l.validade);
      return [{ ...l, produto, dias, faixa: faixaValidade(dias) }];
    })
    .filter((l) => l.dias <= limiar)
    .sort((a, b) => a.dias - b.dias);
}

export type DiaVenda = { data: string; valor: number; label: string };

export function vendasPorDia(movs: Mov[], dias = 30): DiaVenda[] {
  const resultado: DiaVenda[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(new Date(HOJE).getTime() - i * 86_400_000);
    const ds = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const valor = movs
      .filter((m) => m.tipo === "venda" && m.data.slice(0, 10) === ds)
      .reduce((s, m) => s + Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
    resultado.push({ data: ds, valor, label });
  }
  return resultado;
}

export function faturamentoMes(movs: Mov[], anoMes: string): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.slice(0, 7) === anoMes)
    .reduce((s, m) => s + Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export function vendasPeriodo(movs: Mov[], inicio: string, fim: string): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.slice(0, 10) >= inicio && m.data.slice(0, 10) <= fim)
    .reduce((s, m) => s + Math.abs(m.qtd) * (getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export type Classe = "A" | "B" | "C";

export function classificarABC(
  items: { id: string; vendas30: number }[],
): Record<string, Classe> {
  const total = items.reduce((s, x) => s + x.vendas30, 0);
  const sorted = [...items].sort((a, b) => b.vendas30 - a.vendas30);
  const resultado: Record<string, Classe> = {};
  let acumulado = 0;
  for (const item of sorted) {
    acumulado += item.vendas30;
    const pct = total > 0 ? acumulado / total : 0;
    resultado[item.id] = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
  }
  return resultado;
}

export type ScoreDivergencia = {
  usuario: string;
  totalContagens: number;
  totalDivergencias: number;
  mediaAbsoluta: number;
  taxaAcuracia: number;
};

export function calcularScoreDivergencia(
  registros: { usuario: string; contado: number; esperado: number }[],
): ScoreDivergencia[] {
  const porUsuario = new Map<string, { contagens: number; divergencias: number; somaAbsoluta: number }>();
  for (const r of registros) {
    const key = r.usuario || "Desconhecido";
    const cur = porUsuario.get(key) ?? { contagens: 0, divergencias: 0, somaAbsoluta: 0 };
    const dif = Math.abs(r.contado - r.esperado);
    porUsuario.set(key, {
      contagens: cur.contagens + 1,
      divergencias: cur.divergencias + (dif > 0 ? 1 : 0),
      somaAbsoluta: cur.somaAbsoluta + dif,
    });
  }
  return [...porUsuario.entries()]
    .map(([usuario, s]) => ({
      usuario,
      totalContagens: s.contagens,
      totalDivergencias: s.divergencias,
      mediaAbsoluta: s.contagens > 0 ? s.somaAbsoluta / s.contagens : 0,
      taxaAcuracia: s.contagens > 0 ? ((s.contagens - s.divergencias) / s.contagens) * 100 : 100,
    }))
    .sort((a, b) => b.taxaAcuracia - a.taxaAcuracia);
}

export type SugestaoPedido = {
  produto: Produto;
  gondolaAtual: number;
  mediaDiaria: number;
  diasRestantes: number;
  qtdSugerida: number;
};

export function sugestoesPedido(
  movs: Mov[],
  gondola: Record<string, number>,
  diasLead = 7
): SugestaoPedido[] {
  const PERIODO = 31;
  const SEGURANCA = 3;
  const inicio = new Date(new Date(HOJE).getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  const vendas: Record<string, number> = {};
  for (const m of movs) {
    if (m.tipo !== "venda") continue;
    if (m.data.slice(0, 10) < inicio) continue;
    vendas[m.produtoId] = (vendas[m.produtoId] ?? 0) + Math.abs(m.qtd);
  }

  return getProdutos()
    .map((p) => {
      const vendido = vendas[p.id] ?? 0;
      const mediaDiaria = vendido / PERIODO;
      const atual = gondola[p.id] ?? 0;
      const diasRestantes = mediaDiaria > 0 ? Math.floor(atual / mediaDiaria) : 999;
      const meta = Math.ceil((diasLead + SEGURANCA) * mediaDiaria);
      const qtdSugerida = Math.max(0, meta - atual);
      return { produto: p, gondolaAtual: atual, mediaDiaria, diasRestantes, qtdSugerida };
    })
    .filter((s) => s.qtdSugerida > 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}
