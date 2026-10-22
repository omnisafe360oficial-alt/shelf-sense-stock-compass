import { describe, expect, it } from "vitest";
import { transferir, useEstoque } from "./estoque-store";
import { renderHook } from "@testing-library/react";

describe("transferência depósito → gôndola", () => {
  const s = renderHook(() => useEstoque()).result.current;
  it("tira primeiro do lote que vence antes e soma na gôndola", () => {
    const r = transferir(s, "2", 70);
    expect(r.movidos).toEqual([{ lote: "SV1022", qtd: 60 }, { lote: "SV1105", qtd: 10 }]);
    expect(r.estado.gondola["2"]).toBe(76);
  });
  it("bloqueia mais do que tem no depósito", () => {
    expect(() => transferir(s, "3", 75)).toThrow();
  });
});

import { faixaValidade } from "./estoque-store";
describe("faixas de validade", () => {
  it("classifica por dias até vencer", () => {
    expect(faixaValidade(-1)).toBe("vencido");
    expect(faixaValidade(7)).toBe("7");
    expect(faixaValidade(8)).toBe("15");
    expect(faixaValidade(30)).toBe("30");
    expect(faixaValidade(31)).toBe("ok");
  });
});

import { vender } from "./estoque-store";
describe("vender", () => {
  const base = { lotes: [], gondola: { a: 15 }, movs: [] };
  it("desconta da gôndola e avisa ao atingir o mínimo", () => {
    const r = vender(base, [{ produtoId: "a", qtd: 5 }], "Caixa 1", { a: 10 });
    expect(r.estado.gondola.a).toBe(10);
    expect(r.repor).toEqual(["a"]);
  });
  it("não vende mais que a gôndola tem", () => {
    expect(() => vender(base, [{ produtoId: "a", qtd: 16 }], "Caixa 1", { a: 10 })).toThrow();
  });
});
