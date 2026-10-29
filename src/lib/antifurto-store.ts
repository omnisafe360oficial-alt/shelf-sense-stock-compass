import type { Mov } from "./estoque-store";
import type { Produto } from "./mock-data";
import type { IntelProduto } from "./computed";

export type AlertaAntifurto = {
  produtoId: string;
  produtoNome: string;
  produtoCategoria: string;
  perdaAcumulada: number;
  ocorrencias: number;
  ultimaData: string;
  severidade: "alto" | "médio" | "baixo";
  movimentos: Mov[];
};

export type AlertaFuncionario = {
  funcionario: string;
  perdaAcumulada: number;
  ocorrencias: number;
  produtosAfetados: number;
  ultimaData: string;
  severidade: "alto" | "médio" | "baixo";
  movimentos: Mov[];
};

const DIAS_JANELA = 30;

export function calcularAlertas(
  movs: Mov[],
  produtos: Produto[],
  limiar = 2,
): AlertaAntifurto[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DIAS_JANELA);
  const cutoffISO = cutoff.toISOString();

  // Ajustes negativos dentro da janela de 30 dias
  const negativos = movs.filter(
    (m) => m.tipo === "ajuste" && m.qtd < 0 && m.data >= cutoffISO,
  );

  const porProduto = new Map<string, Mov[]>();
  for (const m of negativos) {
    const lista = porProduto.get(m.produtoId) ?? [];
    lista.push(m);
    porProduto.set(m.produtoId, lista);
  }

  const resultado: AlertaAntifurto[] = [];
  for (const [produtoId, lista] of porProduto) {
    const perdaAcumulada = lista.reduce((s, m) => s + Math.abs(m.qtd), 0);
    if (perdaAcumulada < limiar) continue;
    const produto = produtos.find((p) => p.id === produtoId);
    const ultimaData = lista.reduce((d, m) => (m.data > d ? m.data : d), "");
    resultado.push({
      produtoId,
      produtoNome: produto?.nome ?? "Produto desconhecido",
      produtoCategoria: produto?.categoria ?? "—",
      perdaAcumulada,
      ocorrencias: lista.length,
      ultimaData,
      severidade: perdaAcumulada >= 10 ? "alto" : perdaAcumulada >= 5 ? "médio" : "baixo",
      movimentos: [...lista].sort((a, b) => b.data.localeCompare(a.data)),
    });
  }

  return resultado.sort((a, b) => b.perdaAcumulada - a.perdaAcumulada);
}

export type DesvioInteligente = {
  produtoId: string;
  produtoNome: string;
  produtoCategoria: string;
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
  velocidadeDiaria: number;
  totalAjustesNeg: number;
  desvioEmDiasVenda: number;
  risco: "alto" | "médio" | "baixo";
  movimentos: Mov[];
};

export function detectarDesvioEstoque(
  movs: Mov[],
  produtos: Produto[],
  intel: Record<string, IntelProduto>,
  limiarDias = 2,
): DesvioInteligente[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DIAS_JANELA);
  const cutoffISO = cutoff.toISOString();

  const SEV = { alto: 0, médio: 1, baixo: 2 } as const;
  const result: DesvioInteligente[] = [];

  for (const p of produtos) {
    const info = intel[p.id];
    if (!info || info.velocidadeDiaria <= 0) continue;

    const ajustesNeg = movs.filter(
      (m) => m.produtoId === p.id && m.tipo === "ajuste" && m.qtd < 0 && m.data >= cutoffISO,
    );
    const totalLoss = ajustesNeg.reduce((s, m) => s + Math.abs(m.qtd), 0);
    if (totalLoss === 0) continue;

    const desvioEmDias = totalLoss / info.velocidadeDiaria;
    if (desvioEmDias < limiarDias) continue;

    const risco: "alto" | "médio" | "baixo" =
      info.abc === "A" && desvioEmDias >= 3 ? "alto"
      : info.abc !== "C" && desvioEmDias >= 7 ? "alto"
      : desvioEmDias >= 10 ? "alto"
      : info.abc === "A" || desvioEmDias >= 5 ? "médio"
      : "baixo";

    result.push({
      produtoId: p.id,
      produtoNome: p.nome,
      produtoCategoria: p.categoria,
      abc: info.abc,
      xyz: info.xyz,
      velocidadeDiaria: info.velocidadeDiaria,
      totalAjustesNeg: totalLoss,
      desvioEmDiasVenda: Math.round(desvioEmDias * 10) / 10,
      risco,
      movimentos: [...ajustesNeg].sort((a, b) => b.data.localeCompare(a.data)),
    });
  }

  return result.sort((a, b) => SEV[a.risco] - SEV[b.risco] || b.desvioEmDiasVenda - a.desvioEmDiasVenda);
}

export type ConfiabilidadeFuncionario = {
  funcionario: string;
  totalAjustes: number;
  ajustesNegativos: number;
  taxaNegativa: number;
  riscoConfiabilidade: "alto" | "médio" | "baixo";
};

export function calcularConfiabilidade(movs: Mov[]): ConfiabilidadeFuncionario[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DIAS_JANELA);
  const cutoffISO = cutoff.toISOString();

  const ajustes = movs.filter((m) => m.tipo === "ajuste" && m.data >= cutoffISO && m.usuario);
  const porFunc = new Map<string, { total: number; negativos: number }>();
  for (const m of ajustes) {
    const cur = porFunc.get(m.usuario) ?? { total: 0, negativos: 0 };
    porFunc.set(m.usuario, { total: cur.total + 1, negativos: cur.negativos + (m.qtd < 0 ? 1 : 0) });
  }

  return [...porFunc.entries()]
    .map(([funcionario, s]) => {
      const taxa = s.total > 0 ? (s.negativos / s.total) * 100 : 0;
      return {
        funcionario,
        totalAjustes: s.total,
        ajustesNegativos: s.negativos,
        taxaNegativa: Math.round(taxa * 10) / 10,
        riscoConfiabilidade: taxa >= 60 ? "alto" : taxa >= 30 ? "médio" : "baixo",
      } as ConfiabilidadeFuncionario;
    })
    .filter((f) => f.totalAjustes >= 2)
    .sort((a, b) => b.taxaNegativa - a.taxaNegativa);
}

export function calcularAlertasPorFuncionario(
  movs: Mov[],
  limiar = 2,
): AlertaFuncionario[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DIAS_JANELA);
  const cutoffISO = cutoff.toISOString();

  const negativos = movs.filter(
    (m) => m.tipo === "ajuste" && m.qtd < 0 && m.data >= cutoffISO && m.usuario,
  );

  const porFuncionario = new Map<string, Mov[]>();
  for (const m of negativos) {
    const key = m.usuario || "Desconhecido";
    const lista = porFuncionario.get(key) ?? [];
    lista.push(m);
    porFuncionario.set(key, lista);
  }

  const resultado: AlertaFuncionario[] = [];
  for (const [funcionario, lista] of porFuncionario) {
    const perdaAcumulada = lista.reduce((s, m) => s + Math.abs(m.qtd), 0);
    if (perdaAcumulada < limiar) continue;
    const produtosAfetados = new Set(lista.map((m) => m.produtoId)).size;
    const ultimaData = lista.reduce((d, m) => (m.data > d ? m.data : d), "");
    resultado.push({
      funcionario,
      perdaAcumulada,
      ocorrencias: lista.length,
      produtosAfetados,
      ultimaData,
      severidade: perdaAcumulada >= 10 ? "alto" : perdaAcumulada >= 5 ? "médio" : "baixo",
      movimentos: [...lista].sort((a, b) => b.data.localeCompare(a.data)),
    });
  }

  return resultado.sort((a, b) => b.perdaAcumulada - a.perdaAcumulada);
}
