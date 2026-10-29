import { diasAte, faixaValidade, type Faixa, type Lote, type Mov } from "./estoque-store";
import { getProdutos } from "./produtos-store";
import { type Produto } from "./mock-data";

export const getHoje = () => new Date().toISOString().slice(0, 10);
export const getOntem = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
export const HOJE = getHoje();

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
  const diff = new Date(getHoje()).getTime() - new Date(ultimaData.slice(0, 10)).getTime();
  return Math.round(diff / 86_400_000);
}

export function vendasHoje(movs: Mov[]): number {
  const hoje = getHoje();
  return movs
    .filter((m) => m.tipo === "venda" && m.data.startsWith(hoje))
    .reduce((s, m) => s + Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export function vendasOntem(movs: Mov[]): number {
  const ontem = getOntem();
  return movs
    .filter((m) => m.tipo === "venda" && m.data.startsWith(ontem))
    .reduce((s, m) => s + Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

/** Retorna array de 12 valores (R$) para as horas 8h–19h do dia de hoje. */
export function vendasPorHora(movs: Mov[]): number[] {
  const hoje = getHoje();
  const hours = Array.from<number>({ length: 12 }).fill(0);
  for (const m of movs) {
    if (m.tipo !== "venda" || !m.data.startsWith(hoje)) continue;
    const h = parseInt(m.data.slice(11, 13), 10);
    const idx = h - 8;
    if (idx >= 0 && idx < 12) {
      hours[idx] += Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0);
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
  return getProdutos()
    .filter((p) => p.minimoDeposito !== undefined && p.minimoDeposito > 0
      && (totais[p.id] ?? 0) <= p.minimoDeposito)
    .sort((a, b) => (totais[a.id] ?? 0) / a.minimoDeposito! - (totais[b.id] ?? 0) / b.minimoDeposito!);
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
  const hoje = getHoje();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(new Date(hoje + "T12:00:00").getTime() - i * 86_400_000);
    const ds = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const valor = movs
      .filter((m) => m.tipo === "venda" && m.data.slice(0, 10) === ds)
      .reduce((s, m) => s + Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
    resultado.push({ data: ds, valor, label });
  }
  return resultado;
}

export function faturamentoMes(movs: Mov[], anoMes: string): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.slice(0, 7) === anoMes)
    .reduce((s, m) => s + Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export function vendasPeriodo(movs: Mov[], inicio: string, fim: string): number {
  return movs
    .filter((m) => m.tipo === "venda" && m.data.slice(0, 10) >= inicio && m.data.slice(0, 10) <= fim)
    .reduce((s, m) => s + Math.abs(m.qtd) * (m.precoUnitario ?? getProdutos().find((p) => p.id === m.produtoId)?.preco ?? 0), 0);
}

export type Classe = "A" | "B" | "C";
export type ClasseXYZ = "X" | "Y" | "Z";

export type IntelProduto = {
  abc: Classe;
  xyz: ClasseXYZ;
  velocidadeDiaria: number;
  desvio: number;
  cv: number;
  estoqueSeguranca: number;
  pontoPedido: number;
  /** [dom, seg, ter, qua, qui, sex, sab] — média 1.0 */
  coefDiaSemana: number[];
  diasEstoque: number;
};

const DIAS_HIST = 60;
const Z_95 = 1.65;

export function inteligenciaProdutos(
  movs: Mov[],
  gondola: Record<string, number>,
  lotes: Lote[],
  leadTimePadrao = 7,
): Record<string, IntelProduto> {
  const produtos = getProdutos();
  const hoje = getHoje();
  const base = new Date(hoje + "T12:00:00");
  const inicio = new Date(base.getTime() - DIAS_HIST * 86_400_000).toISOString().slice(0, 10);
  const t30 = new Date(base.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  const dates: { iso: string; dow: number }[] = [];
  for (let i = DIAS_HIST - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86_400_000);
    dates.push({ iso: d.toISOString().slice(0, 10), dow: d.getDay() });
  }

  const vendaDia: Record<string, Record<string, number>> = {};
  const receita30: Record<string, number> = {};
  for (const m of movs) {
    if (m.tipo !== "venda") continue;
    const d = m.data.slice(0, 10);
    if (d < inicio) continue;
    if (!vendaDia[m.produtoId]) vendaDia[m.produtoId] = {};
    vendaDia[m.produtoId][d] = (vendaDia[m.produtoId][d] ?? 0) + Math.abs(m.qtd);
    if (d >= t30) {
      const p = produtos.find((x) => x.id === m.produtoId);
      receita30[m.produtoId] = (receita30[m.produtoId] ?? 0) +
        Math.abs(m.qtd) * (m.precoUnitario ?? p?.preco ?? 0);
    }
  }

  const abc = classificarABC(produtos.map((p) => ({ id: p.id, vendas30: receita30[p.id] ?? 0 })));

  const deposito: Record<string, number> = {};
  for (const l of lotes) if (l.qtd > 0) deposito[l.produtoId] = (deposito[l.produtoId] ?? 0) + l.qtd;

  const result: Record<string, IntelProduto> = {};
  for (const p of produtos) {
    const daysData = vendaDia[p.id] ?? {};
    const series = dates.map((d) => daysData[d.iso] ?? 0);
    const n = series.length;
    const mean = series.reduce((s, v) => s + v, 0) / n;
    const variance = n > 1 ? series.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const desvio = Math.sqrt(variance);
    const cv = mean > 0 ? desvio / mean : 0;
    const xyz: ClasseXYZ = cv < 0.2 ? "X" : cv < 0.5 ? "Y" : "Z";
    const estoqueSeguranca = Math.ceil(Z_95 * desvio * Math.sqrt(leadTimePadrao));
    const pontoPedido = Math.ceil(mean * leadTimePadrao) + estoqueSeguranca;

    const dowSum = [0, 0, 0, 0, 0, 0, 0];
    const dowN = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) { dowSum[dates[i].dow] += series[i]; dowN[dates[i].dow]++; }
    const dowAvg = dowSum.map((s, i) => (dowN[i] > 0 ? s / dowN[i] : 0));
    const globalMean = dowAvg.reduce((s, v) => s + v, 0) / 7;
    const coefDiaSemana = dowAvg.map((v) => (globalMean > 0 ? Math.round((v / globalMean) * 100) / 100 : 1));

    const estoqueTotal = (gondola[p.id] ?? 0) + (deposito[p.id] ?? 0);
    const diasEstoque = mean > 0 ? Math.floor(estoqueTotal / mean) : 999;

    result[p.id] = {
      abc: abc[p.id] ?? "C",
      xyz,
      velocidadeDiaria: Math.round(mean * 100) / 100,
      desvio: Math.round(desvio * 100) / 100,
      cv: Math.round(cv * 100) / 100,
      estoqueSeguranca,
      pontoPedido,
      coefDiaSemana,
      diasEstoque,
    };
  }
  return result;
}

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
  estoqueSeguranca: number;
  pontoPedido: number;
};

export function depositoMap(lotes: Lote[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const l of lotes) {
    if (l.qtd > 0) map[l.produtoId] = (map[l.produtoId] ?? 0) + l.qtd;
  }
  return map;
}

export function sugestoesPedido(
  movs: Mov[],
  gondola: Record<string, number>,
  depositoOuDiasLead: Record<string, number> | number = {},
  diasLead = 7,
  intel: Record<string, IntelProduto> = {},
): SugestaoPedido[] {
  let deposito: Record<string, number>;
  if (typeof depositoOuDiasLead === "number") {
    diasLead = depositoOuDiasLead;
    deposito = {};
  } else {
    deposito = depositoOuDiasLead;
  }
  const PERIODO = 31;
  const SEGURANCA = 3;
  const hoje = getHoje();
  const inicio = new Date(new Date(hoje + "T12:00:00").getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

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
      const gondolaAtual = gondola[p.id] ?? 0;
      const depositoAtual = deposito[p.id] ?? 0;
      const estoqueTotal = gondolaAtual + depositoAtual;
      const diasRestantes = mediaDiaria > 0 ? Math.floor(estoqueTotal / mediaDiaria) : 999;
      const estoqueSeguranca = intel[p.id]?.estoqueSeguranca ?? Math.ceil(SEGURANCA * mediaDiaria);
      const pontoPedido = intel[p.id]?.pontoPedido ?? Math.ceil(mediaDiaria * diasLead) + estoqueSeguranca;
      const meta = Math.ceil(mediaDiaria * diasLead) + estoqueSeguranca;
      const teto = p.maximoDeposito ?? Infinity;
      const qtdSugerida = Math.max(0, Math.min(meta - estoqueTotal, teto - estoqueTotal));
      return { produto: p, gondolaAtual, mediaDiaria, diasRestantes, qtdSugerida, estoqueSeguranca, pontoPedido };
    })
    .filter((s) => s.qtdSugerida > 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}
