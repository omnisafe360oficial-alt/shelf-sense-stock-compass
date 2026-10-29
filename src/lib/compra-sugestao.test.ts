import { describe, it, expect } from "vitest";
import { sugerirCompras } from "./compra-sugestao";
import type { Produto } from "./mock-data";

const prod = (o: Partial<Produto>): Produto =>
  ({ id: "x", nome: "P", codigo: "", categoria: "", fornecedor: "", preco: 1, deposito: 0, gondola: 0, minimo: 5, validade: "", ...o }) as Produto;

describe("sugestão de compra", () => {
  it("produto com depósito zerado entra uma vez só", () => {
    const g = sugerirCompras([prod({ id: "a", fornecedor: "F1" })], { a: 0 }, new Set());
    expect(g.flatMap((x) => x.itens).length).toBe(1);
  });
  it("depósito acima do mínimo não entra", () => {
    const g = sugerirCompras([prod({ id: "a", minimoDeposito: 10 })], { a: 11 }, new Set());
    expect(g.length).toBe(0);
  });
  it("produto já em pedido aberto não entra de novo", () => {
    const g = sugerirCompras([prod({ id: "a" })], { a: 0 }, new Set(["a"]));
    expect(g.length).toBe(0);
  });
  it("dois fornecedores geram dois grupos", () => {
    const g = sugerirCompras(
      [prod({ id: "a", fornecedorId: "f1", fornecedor: "F1" }), prod({ id: "b", fornecedorId: "f2", fornecedor: "F2" })],
      {}, new Set(),
    );
    expect(g.length).toBe(2);
  });
  it("pede até o dobro do mínimo quando não há máximo", () => {
    const g = sugerirCompras([prod({ id: "a", minimoDeposito: 10 })], { a: 4 }, new Set());
    expect(g[0]!.itens[0]!.qtd).toBe(16);
  });
  it("arredonda para fardo fechado: mínimo 10, fardo 12, depósito 0 → 2 fardos (24 un)", () => {
    const g = sugerirCompras([prod({ id: "a", nome: "CERVEJA LATA 350ML FARDO 12", minimoDeposito: 10 })], { a: 0 }, new Set());
    expect(g[0]!.itens[0]!.caixas).toBe(2);
    expect(g[0]!.itens[0]!.qtd).toBe(24);
  });
  it("mínimo 10, máximo 12, fardo 12 → 1 fardo", () => {
    const g = sugerirCompras([prod({ id: "a", nome: "AGUA 500ML CX 12UN", minimoDeposito: 10, maximoDeposito: 12 })], { a: 0 }, new Set());
    expect(g[0]!.itens[0]!.caixas).toBe(1);
  });
});
