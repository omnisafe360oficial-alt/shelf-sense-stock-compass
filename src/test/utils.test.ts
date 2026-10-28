import { describe, it, expect } from "vitest";
import { brl, isFracionado, situacao, stepUnidade, type Produto } from "@/lib/mock-data";
import { vendasPorProduto, diasSemVenda, classificarABC, calcularScoreDivergencia } from "@/lib/computed";
import { calcularAlertas, calcularAlertasPorFuncionario } from "@/lib/antifurto-store";
import type { Mov } from "@/lib/estoque-store";

// ─── brl ─────────────────────────────────────────────────────────────────────

describe("brl", () => {
  it("formats zero", () => {
    expect(brl(0)).toMatch(/R\$\s*0,00/);
  });

  it("formats a positive value with two decimal places", () => {
    expect(brl(1.5)).toMatch(/1,50/);
  });

  it("formats thousands with dot separator", () => {
    expect(brl(1000)).toMatch(/1\.000,00/);
  });

  it("formats negative values", () => {
    expect(brl(-9.99)).toMatch(/-?R\$.*9,99/);
  });
});

// ─── isFracionado ─────────────────────────────────────────────────────────────

describe("isFracionado", () => {
  it("returns false for 'un' (the default)", () => {
    expect(isFracionado("un")).toBe(false);
  });

  it("returns false when undefined", () => {
    expect(isFracionado(undefined)).toBe(false);
  });

  it("returns true for 'kg'", () => {
    expect(isFracionado("kg")).toBe(true);
  });

  it("returns true for 'L'", () => {
    expect(isFracionado("L")).toBe(true);
  });

  it("returns true for 'g'", () => {
    expect(isFracionado("g")).toBe(true);
  });

  it("returns false for 'dz'", () => {
    expect(isFracionado("dz")).toBe(false);
  });
});

// ─── stepUnidade ──────────────────────────────────────────────────────────────

describe("stepUnidade", () => {
  it("returns 1 for 'un'", () => {
    expect(stepUnidade("un")).toBe(1);
  });

  it("returns 1 for undefined", () => {
    expect(stepUnidade(undefined)).toBe(1);
  });

  it("returns 1 for 'g'", () => {
    expect(stepUnidade("g")).toBe(1);
  });

  it("returns 1 for 'mL'", () => {
    expect(stepUnidade("mL")).toBe(1);
  });

  it("returns 0.1 for 'kg'", () => {
    expect(stepUnidade("kg")).toBe(0.1);
  });

  it("returns 0.1 for 'L'", () => {
    expect(stepUnidade("L")).toBe(0.1);
  });
});

// ─── situacao ────────────────────────────────────────────────────────────────

const makeProd = (overrides: Partial<Produto>): Produto => ({
  id: "p1",
  nome: "Teste",
  codigo: "000",
  categoria: "Higiene",
  fornecedor: "X",
  preco: 1,
  deposito: 0,
  gondola: 0,
  minimo: 5,
  ...overrides,
});

describe("situacao", () => {
  it("returns 'sem' when both gondola and deposito are 0", () => {
    expect(situacao(makeProd({ gondola: 0, deposito: 0 }))).toBe("sem");
  });

  it("returns 'sem' when deposito is 0 and gondola is below minimo", () => {
    expect(situacao(makeProd({ gondola: 3, deposito: 0, minimo: 5 }))).toBe("sem");
  });

  it("returns 'baixo' when gondola equals minimo", () => {
    expect(situacao(makeProd({ gondola: 5, deposito: 10, minimo: 5 }))).toBe("baixo");
  });

  it("returns 'baixo' when gondola is below minimo but deposito has stock", () => {
    expect(situacao(makeProd({ gondola: 2, deposito: 20, minimo: 5 }))).toBe("baixo");
  });

  it("returns 'ok' when gondola is above minimo", () => {
    expect(situacao(makeProd({ gondola: 10, deposito: 0, minimo: 5 }))).toBe("ok");
  });
});

// ─── vendasPorProduto ─────────────────────────────────────────────────────────

const makeVenda = (produtoId: string, qtd: number, data: string): Mov => ({
  id: `m-${produtoId}-${data}`,
  tipo: "venda",
  produtoId,
  qtd,
  data,
  usuario: "test",
  origem: "gondola",
  destino: "venda",
});

describe("vendasPorProduto", () => {
  it("returns empty record for empty array", () => {
    expect(vendasPorProduto([])).toEqual({});
  });

  it("ignores non-venda movements", () => {
    const mov: Mov = { id: "m1", tipo: "entrada", produtoId: "p1", qtd: 10, data: "2026-01-01", usuario: "test", origem: "deposito", destino: "gondola" };
    expect(vendasPorProduto([mov])).toEqual({});
  });

  it("sums quantities per product", () => {
    const movs = [
      makeVenda("p1", 3, "2026-01-01"),
      makeVenda("p1", 5, "2026-01-02"),
      makeVenda("p2", 2, "2026-01-03"),
    ];
    const result = vendasPorProduto(movs);
    expect(result["p1"].un).toBe(8);
    expect(result["p2"].un).toBe(2);
  });

  it("tracks the latest date per product", () => {
    const movs = [
      makeVenda("p1", 1, "2026-01-01"),
      makeVenda("p1", 1, "2026-01-05"),
      makeVenda("p1", 1, "2026-01-03"),
    ];
    expect(vendasPorProduto(movs)["p1"].ultimaData).toBe("2026-01-05");
  });
});

// ─── diasSemVenda ─────────────────────────────────────────────────────────────

describe("diasSemVenda", () => {
  it("returns 999 for null", () => {
    expect(diasSemVenda(null)).toBe(999);
  });

  it("returns a non-negative number for a past date", () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    expect(diasSemVenda(past)).toBeGreaterThanOrEqual(4);
  });
});

// ─── calcularAlertas ──────────────────────────────────────────────────────────

const makeAjuste = (produtoId: string, qtd: number, daysAgo: number): Mov => ({
  id: `aj-${produtoId}-${daysAgo}`,
  tipo: "ajuste",
  produtoId,
  qtd,
  data: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  usuario: "test",
  origem: "deposito",
  destino: "ajuste",
});

const prods: Produto[] = [
  makeProd({ id: "p1", nome: "Produto A", categoria: "Higiene" }),
  makeProd({ id: "p2", nome: "Produto B", categoria: "Limpeza" }),
];

describe("calcularAlertas", () => {
  it("returns empty array when no negative adjustments exist", () => {
    const movs = [makeAjuste("p1", 5, 1)]; // positive — not suspicious
    expect(calcularAlertas(movs, prods)).toHaveLength(0);
  });

  it("ignores adjustments older than 30 days", () => {
    const movs = [makeAjuste("p1", -5, 35)];
    expect(calcularAlertas(movs, prods)).toHaveLength(0);
  });

  it("ignores product with total loss below limiar", () => {
    const movs = [makeAjuste("p1", -1, 1)];
    expect(calcularAlertas(movs, prods, 2)).toHaveLength(0);
  });

  it("includes product when total loss meets limiar", () => {
    const movs = [makeAjuste("p1", -2, 1)];
    const alerts = calcularAlertas(movs, prods, 2);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].produtoId).toBe("p1");
  });

  it("assigns severidade 'baixo' for loss 2–4", () => {
    const movs = [makeAjuste("p1", -3, 1)];
    expect(calcularAlertas(movs, prods, 2)[0].severidade).toBe("baixo");
  });

  it("assigns severidade 'médio' for loss 5–9", () => {
    const movs = [makeAjuste("p1", -7, 1)];
    expect(calcularAlertas(movs, prods, 2)[0].severidade).toBe("médio");
  });

  it("assigns severidade 'alto' for loss >= 10", () => {
    const movs = [makeAjuste("p1", -12, 1)];
    expect(calcularAlertas(movs, prods, 2)[0].severidade).toBe("alto");
  });

  it("sorts results by perdaAcumulada descending", () => {
    const movs = [
      makeAjuste("p1", -3, 1),
      makeAjuste("p2", -8, 1),
    ];
    const alerts = calcularAlertas(movs, prods, 2);
    expect(alerts[0].produtoId).toBe("p2");
    expect(alerts[1].produtoId).toBe("p1");
  });

  it("uses 'Produto desconhecido' for unknown product id", () => {
    const movs = [makeAjuste("unknown", -5, 1)];
    const alerts = calcularAlertas(movs, prods, 2);
    expect(alerts[0].produtoNome).toBe("Produto desconhecido");
  });

  it("sums losses across multiple movements", () => {
    const movs = [
      makeAjuste("p1", -2, 1),
      makeAjuste("p1", -4, 2),
    ];
    expect(calcularAlertas(movs, prods, 2)[0].perdaAcumulada).toBe(6);
    expect(calcularAlertas(movs, prods, 2)[0].ocorrencias).toBe(2);
  });
});

// ─── calcularAlertasPorFuncionario ───────────────────────────────────────────

const makeAjusteUser = (produtoId: string, qtd: number, daysAgo: number, usuario: string): Mov => ({
  id: `aj-${produtoId}-${daysAgo}-${usuario}`,
  tipo: "ajuste",
  produtoId,
  qtd,
  data: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  usuario,
  origem: "deposito",
  destino: "ajuste",
});

describe("calcularAlertasPorFuncionario", () => {
  it("returns empty array when no negative adjustments", () => {
    const movs = [makeAjusteUser("p1", 5, 1, "Ana")];
    expect(calcularAlertasPorFuncionario(movs)).toEqual([]);
  });

  it("ignores adjustments older than 30 days", () => {
    const movs = [makeAjusteUser("p1", -10, 35, "Ana")];
    expect(calcularAlertasPorFuncionario(movs)).toEqual([]);
  });

  it("ignores adjustments below limiar", () => {
    const movs = [makeAjusteUser("p1", -1, 1, "Ana")];
    expect(calcularAlertasPorFuncionario(movs, 2)).toEqual([]);
  });

  it("groups by usuario and sums losses", () => {
    const movs = [
      makeAjusteUser("p1", -3, 1, "Ana"),
      makeAjusteUser("p2", -4, 2, "Ana"),
    ];
    const result = calcularAlertasPorFuncionario(movs, 2);
    expect(result).toHaveLength(1);
    expect(result[0].funcionario).toBe("Ana");
    expect(result[0].perdaAcumulada).toBe(7);
    expect(result[0].ocorrencias).toBe(2);
    expect(result[0].produtosAfetados).toBe(2);
  });

  it("assigns severidade alto when perdaAcumulada >= 10", () => {
    const movs = [makeAjusteUser("p1", -12, 1, "Bob")];
    expect(calcularAlertasPorFuncionario(movs, 2)[0].severidade).toBe("alto");
  });

  it("assigns severidade médio when perdaAcumulada in [5, 10)", () => {
    const movs = [makeAjusteUser("p1", -7, 1, "Bob")];
    expect(calcularAlertasPorFuncionario(movs, 2)[0].severidade).toBe("médio");
  });

  it("assigns severidade baixo when perdaAcumulada in [limiar, 5)", () => {
    const movs = [makeAjusteUser("p1", -3, 1, "Bob")];
    expect(calcularAlertasPorFuncionario(movs, 2)[0].severidade).toBe("baixo");
  });

  it("sorts by perdaAcumulada descending", () => {
    const movs = [
      makeAjusteUser("p1", -3, 1, "Ana"),
      makeAjusteUser("p1", -10, 1, "Bob"),
    ];
    const result = calcularAlertasPorFuncionario(movs, 2);
    expect(result[0].funcionario).toBe("Bob");
    expect(result[1].funcionario).toBe("Ana");
  });

  it("ignores movements without usuario (empty string filtered out)", () => {
    const mov: Mov = { id: "m1", tipo: "ajuste", produtoId: "p1", qtd: -5, data: new Date().toISOString(), usuario: "", origem: "deposito", destino: "ajuste" };
    expect(calcularAlertasPorFuncionario([mov], 2)).toEqual([]);
  });
});

// ─── classificarABC ──────────────────────────────────────────────────────────

describe("classificarABC", () => {
  it("returns empty record for empty array", () => {
    expect(classificarABC([])).toEqual({});
  });

  it("classifies all items as A when all zero sales", () => {
    const items = [{ id: "p1", vendas30: 0 }, { id: "p2", vendas30: 0 }];
    const result = classificarABC(items);
    expect(result["p1"]).toBe("A");
    expect(result["p2"]).toBe("A");
  });

  it("classifies top 80% by value as A", () => {
    const items = [
      { id: "p1", vendas30: 80 },
      { id: "p2", vendas30: 10 },
      { id: "p3", vendas30: 10 },
    ];
    const result = classificarABC(items);
    expect(result["p1"]).toBe("A");
  });

  it("classifies items between 80% and 95% as B", () => {
    const items = [
      { id: "p1", vendas30: 80 },
      { id: "p2", vendas30: 15 },
      { id: "p3", vendas30: 5 },
    ];
    const result = classificarABC(items);
    expect(result["p2"]).toBe("B");
  });

  it("classifies items beyond 95% as C", () => {
    const items = [
      { id: "p1", vendas30: 80 },
      { id: "p2", vendas30: 15 },
      { id: "p3", vendas30: 5 },
    ];
    const result = classificarABC(items);
    expect(result["p3"]).toBe("C");
  });

  it("assigns every id a class", () => {
    const items = [{ id: "x", vendas30: 100 }, { id: "y", vendas30: 1 }];
    const result = classificarABC(items);
    expect(Object.keys(result)).toHaveLength(2);
  });
});

// ─── calcularScoreDivergencia ────────────────────────────────────────────────

describe("calcularScoreDivergencia", () => {
  it("returns empty array for empty input", () => {
    expect(calcularScoreDivergencia([])).toEqual([]);
  });

  it("computes 100% accuracy when no divergences", () => {
    const result = calcularScoreDivergencia([{ usuario: "Ana", contado: 10, esperado: 10 }]);
    expect(result[0].taxaAcuracia).toBe(100);
    expect(result[0].totalDivergencias).toBe(0);
    expect(result[0].mediaAbsoluta).toBe(0);
  });

  it("computes 0% accuracy when every count diverges", () => {
    const registros = [
      { usuario: "Bob", contado: 5, esperado: 10 },
      { usuario: "Bob", contado: 3, esperado: 8 },
    ];
    const result = calcularScoreDivergencia(registros);
    expect(result[0].taxaAcuracia).toBe(0);
    expect(result[0].totalDivergencias).toBe(2);
  });

  it("computes partial accuracy correctly", () => {
    const registros = [
      { usuario: "Carol", contado: 10, esperado: 10 },
      { usuario: "Carol", contado: 8, esperado: 10 },
      { usuario: "Carol", contado: 10, esperado: 10 },
      { usuario: "Carol", contado: 10, esperado: 10 },
    ];
    const result = calcularScoreDivergencia(registros);
    expect(result[0].taxaAcuracia).toBe(75);
    expect(result[0].mediaAbsoluta).toBe(0.5);
  });

  it("groups by usuario", () => {
    const registros = [
      { usuario: "Ana", contado: 10, esperado: 10 },
      { usuario: "Bob", contado: 5, esperado: 10 },
    ];
    const result = calcularScoreDivergencia(registros);
    expect(result).toHaveLength(2);
  });

  it("sorts by taxaAcuracia descending", () => {
    const registros = [
      { usuario: "Bad", contado: 1, esperado: 10 },
      { usuario: "Good", contado: 10, esperado: 10 },
    ];
    const result = calcularScoreDivergencia(registros);
    expect(result[0].usuario).toBe("Good");
    expect(result[1].usuario).toBe("Bad");
  });

  it("uses 'Desconhecido' for empty usuario", () => {
    const result = calcularScoreDivergencia([{ usuario: "", contado: 5, esperado: 10 }]);
    expect(result[0].usuario).toBe("Desconhecido");
  });
});
