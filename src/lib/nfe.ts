export type ItemNfe = {
  codigo: string;
  nome: string;
  unidadeCompra: string;
  qtdCompra: number;
  custoUnitCompra: number;
  lote?: string;
  validade?: string;
};
export type Nfe = { numero: string; emissao: string; fornecedor: { nome: string; cnpj: string; cidade: string }; itens: ItemNfe[] };

const txt = (el: Element | null | undefined, tag: string) => el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";

/** Lê o XML de uma NF-e (padrão SEFAZ) e extrai fornecedor e itens. */
export function lerNfe(xml: string): Nfe {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Arquivo XML inválido.");
  const emit = doc.getElementsByTagName("emit")[0];
  const ide = doc.getElementsByTagName("ide")[0];
  if (!emit) throw new Error("Este XML não parece ser uma NF-e.");
  const cnpj = txt(emit, "CNPJ").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const itens = Array.from(doc.getElementsByTagName("det")).map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    const ean = txt(prod, "cEAN");
    const rastro = det.getElementsByTagName("rastro")[0];
    return {
      codigo: ean && ean !== "SEM GTIN" ? ean : txt(prod, "cProd"),
      nome: txt(prod, "xProd"),
      unidadeCompra: txt(prod, "uCom") || "UN",
      qtdCompra: Number(txt(prod, "qCom")) || 0,
      custoUnitCompra: Number(txt(prod, "vUnCom")) || 0,
      lote: txt(rastro, "nLote") || undefined,
      validade: txt(rastro, "dVal") || undefined,
    };
  });
  return {
    numero: txt(ide, "nNF"),
    emissao: txt(ide, "dhEmi").slice(0, 10),
    fornecedor: { nome: txt(emit, "xNome"), cnpj, cidade: `${txt(emit, "xMun")} · ${txt(emit, "UF")}` },
    itens,
  };
}

/** Tenta descobrir quantas unidades vêm por embalagem pelo nome (ex.: "CX 12UN", "C/24", "PACK 6"). */
export function sugerirConversao(nome: string, unidade: string): number {
  if (/^(UN|UND|UNID|KG|L|LT)$/i.test(unidade)) return 1;
  const m = nome.match(/(?:C\/|CX\s*|PACK\s*|FD\s*|X\s*)(\d{1,3})\s*(?:UN)?/i) ?? nome.match(/(\d{1,3})\s*UN\b/i);
  return m ? Number(m[1]) : 1;
}

export const XML_EXEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc><NFe><infNFe>
<ide><nNF>48213</nNF><dhEmi>2026-10-21T09:12:00-03:00</dhEmi></ide>
<emit><CNPJ>61068276000104</CNPJ><xNome>Unilever Brasil</xNome><enderEmit><xMun>São Paulo</xMun><UF>SP</UF></enderEmit></emit>
<det nItem="1"><prod><cProd>LUX85</cProd><cEAN>7891150037410</cEAN><xProd>SABONETE LUX 85G CX 12UN</xProd><uCom>CX</uCom><qCom>20</qCom><vUnCom>24.60</vUnCom></prod><rastro><nLote>LX2610</nLote><dVal>2028-09-30</dVal></rastro></det>
<det nItem="2"><prod><cProd>SED325</cProd><cEAN>7891037000325</cEAN><xProd>SHAMPOO SEDA 325ML C/6</xProd><uCom>CX</uCom><qCom>8</qCom><vUnCom>51.00</vUnCom></prod><rastro><nLote>SD7781</nLote><dVal>2028-05-12</dVal></rastro></det>
<det nItem="3"><prod><cProd>DOV90</cProd><cEAN>7891037010904</cEAN><xProd>SABONETE DOVE 90G CX 12UN</xProd><uCom>CX</uCom><qCom>10</qCom><vUnCom>38.40</vUnCom></prod><rastro><nLote>DV1120</nLote><dVal>2028-07-01</dVal></rastro></det>
<det nItem="4"><prod><cProd>REX150</cProd><cEAN>7891037150150</cEAN><xProd>DESODORANTE REXONA AERO 150ML PACK 6</xProd><uCom>PCT</uCom><qCom>12</qCom><vUnCom>69.00</vUnCom></prod></det>
<det nItem="5"><prod><cProd>OMO1K</cProd><cEAN>7891150064003</cEAN><xProd>LAVA ROUPAS OMO PO 1,6KG FD 9</xProd><uCom>FD</uCom><qCom>5</qCom><vUnCom>171.00</vUnCom></prod><rastro><nLote>OM5530</nLote><dVal>2028-12-20</dVal></rastro></det>
</infNFe></NFe></nfeProc>`;
