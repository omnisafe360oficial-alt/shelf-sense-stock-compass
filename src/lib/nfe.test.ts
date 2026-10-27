import { describe, expect, it } from "vitest";
import { lerNfe, sugerirConversao, XML_EXEMPLO } from "./nfe";

describe("NF-e", () => {
  it("lê fornecedor e itens do XML", () => {
    const n = lerNfe(XML_EXEMPLO);
    expect(n.fornecedor.cnpj).toBe("61.068.276/0001-04");
    expect(n.itens).toHaveLength(7);
    expect(n.itens[0]).toMatchObject({ codigo: "7891150037410", qtdCompra: 20, lote: "LX2610" });
  });
  it("sugere conversão da embalagem pelo nome", () => {
    expect(sugerirConversao("SABONETE LUX 85G CX 12UN", "CX")).toBe(12);
    expect(sugerirConversao("SHAMPOO SEDA C/6", "CX")).toBe(6);
    expect(sugerirConversao("ARROZ 5KG", "UN")).toBe(1);
  });
  it("normaliza dVal AAAA-MM para último dia do mês", () => {
    const xml = XML_EXEMPLO.replace('<dVal>2028-09-30</dVal>', '<dVal>2028-09</dVal>');
    const n = lerNfe(xml);
    expect(n.itens[0].validade).toBe("2028-09-30");
  });
  it("normaliza dVal AAAA-MM em meses com 28, 30 e 31 dias", () => {
    const mkXml = (dVal: string) =>
      XML_EXEMPLO.replace('<dVal>2028-09-30</dVal>', `<dVal>${dVal}</dVal>`);
    expect(lerNfe(mkXml("2028-02")).itens[0].validade).toBe("2028-02-29"); // 2028 é bissexto
    expect(lerNfe(mkXml("2028-04")).itens[0].validade).toBe("2028-04-30");
    expect(lerNfe(mkXml("2028-01")).itens[0].validade).toBe("2028-01-31");
  });
});
