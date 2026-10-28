import type { Mov } from "./estoque-store";
import type { Produto } from "./mock-data";

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
