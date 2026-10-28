import { describe, expect, it } from "vitest";
import { transferir, faixaValidade, vender } from "./estoque-store";

// Mock state for transferir tests
// Product "2": SV1022 (60 un, vence antes) + SV1105 (20 un, vence depois) = 80 no depósito, 6 na gôndola
// Product "3": X001 (50 un) = 50 no depósito — insuficiente para 75
const mockEstoque = {
  lotes: [
    { id: "l1", produtoId: "2", lote: "SV1022", validade: "2025-10-01", qtd: 60, local: "C1" },
    { id: "l2", produtoId: "2", lote: "SV1105", validade: "2025-11-05", qtd: 20, local: "C1" },
    { id: "l3", produtoId: "3", lote: "X001",   validade: "2025-12-01", qtd: 50, local: "C2" },
  ],
  gondola: { "2": 6 },
  movs: [],
};

describe("transferência depósito → gôndola", () => {
  it("tira primeiro do lote que vence antes e soma na gôndola", () => {
    const r = transferir(mockEstoque, "2", 70);
    expect(r.movidos).toEqual([{ lote: "SV1022", qtd: 60 }, { lote: "SV1105", qtd: 10 }]);
    expect(r.estado.gondola["2"]).toBe(76);
  });
  it("bloqueia mais do que tem no depósito", () => {
    expect(() => transferir(mockEstoque, "3", 75)).toThrow();
  });
});

describe("faixas de validade", () => {
  it("classifica por dias até vencer", () => {
    expect(faixaValidade(-1)).toBe("vencido");
    expect(faixaValidade(7)).toBe("7");
    expect(faixaValidade(8)).toBe("15");
    expect(faixaValidade(30)).toBe("30");
    expect(faixaValidade(31)).toBe("ok");
  });
});

describe("vender", () => {
  const base = { lotes: [], gondola: { a: 15 }, movs: [] };
  it("desconta da gôndola e avisa ao atingir o mínimo", () => {
    const r = vender(base, [{ produtoId: "a", qtd: 5 }], "Caixa 1", { a: 10 });
    expect(r.estado.gondola["a"]).toBe(10);
    expect(r.repor).toEqual(["a"]);
  });
  it("não vende mais que a gôndola tem", () => {
    expect(() => vender(base, [{ produtoId: "a", qtd: 16 }], "Caixa 1", { a: 10 })).toThrow();
  });
});
