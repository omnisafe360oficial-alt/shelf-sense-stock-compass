import { describe, expect, it } from "vitest";
import { lerNfe, sugerirConversao, XML_EXEMPLO } from "./nfe";

describe("NF-e", () => {
  it("lê fornecedor e itens do XML", () => {
    const n = lerNfe(XML_EXEMPLO);
    expect(n.fornecedor.cnpj).toBe("61.068.276/0001-04");
    expect(n.itens).toHaveLength(5);
    expect(n.itens[0]).toMatchObject({ codigo: "7891150037410", qtdCompra: 20, lote: "LX2610" });
  });
  it("sugere conversão da embalagem pelo nome", () => {
    expect(sugerirConversao("SABONETE LUX 85G CX 12UN", "CX")).toBe(12);
    expect(sugerirConversao("SHAMPOO SEDA C/6", "CX")).toBe(6);
    expect(sugerirConversao("ARROZ 5KG", "UN")).toBe(1);
  });
});
