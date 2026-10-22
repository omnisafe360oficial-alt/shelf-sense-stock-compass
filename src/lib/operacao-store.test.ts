import { describe, expect, it } from "vitest";
import { compararNota, emUnidades, type Nota } from "./operacao-store";

describe("conferência cega do recebimento", () => {
  it("converte caixas fechadas + unidades soltas", () => {
    expect(emUnidades(9, 12, 6)).toBe(114);
  });
  it("aponta a diferença entre a nota e o contado", () => {
    const nota: Nota = { id: "x", numero: "1", fornecedor: "", chegada: "", status: "aguardando", itens: [
      { produtoId: "a", caixas: 10, fator: 12, embalagem: "", lote: "", validade: "" },
      { produtoId: "b", caixas: 2, fator: 6, embalagem: "", lote: "", validade: "" },
    ] };
    const r = compararNota(nota, { a: 114, b: 12 });
    expect(r[0]!.diferenca).toBe(-6);
    expect(r[1]!.diferenca).toBe(0);
  });
});
