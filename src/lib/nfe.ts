export type ItemNfe = {
  codigo: string;
  nome: string;
  unidadeCompra: string;
  qtdCompra: number;
  custoUnitCompra: number;
  lote?: string | undefined;
  validade?: string | undefined;
};
export type Nfe = { numero: string; emissao: string; fornecedor: { nome: string; cnpj: string; cidade: string }; itens: ItemNfe[] };

const txt = (el: Element | null | undefined, tag: string) => el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";

/** SEFAZ envia dVal como AAAA-MM; normaliza para AAAA-MM-DD (último dia do mês). */
function normalizarDVal(dVal: string): string {
  if (!dVal) return dVal;
  if (dVal.length === 7) {
    const [y, m] = dVal.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${dVal}-${String(lastDay).padStart(2, "0")}`;
  }
  return dVal.slice(0, 10);
}

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
      validade: normalizarDVal(txt(rastro, "dVal")) || undefined,
    };
  });
  return {
    numero: txt(ide, "nNF"),
    emissao: txt(ide, "dhEmi").slice(0, 10),
    fornecedor: { nome: txt(emit, "xNome"), cnpj, cidade: `${txt(emit, "xMun")} · ${txt(emit, "UF")}` },
    itens,
  };
}

/** Tenta descobrir quantas unidades vêm por embalagem pelo nome (ex.: "CX 12UN", "C/24", "PACK 6", "FARDO 12", "6X1"). */
export function sugerirConversao(nome: string, unidade: string): number {
  if (/^(UN|UND|UNID|KG|L|LT)$/i.test(unidade)) return 1;
  // CX 12, PACK 6, FD 9, FD9, PCT 6, C/24, BD 20, BANDEJA 12, FARDO 12
  const m1 = nome.match(/(?:\bC\/|\bCX\s*|\bPACK\s*|\bFD\s*|\bPCT\s*|\bBD\s*|\bBANDEJA\s*|\bFARDO\s*)(\d{1,3})(?!\s*(?:G|KG|ML|L)\b)/i);
  if (m1) return Number(m1[1]);
  // 12UN, 24UN
  const m2 = nome.match(/(\d{1,3})\s*UN\b/i);
  if (m2) return Number(m2[1]);
  // 6X1, 12X2, 24X330ML — formato NxN (primeiro número = qtd por embalagem)
  const m3 = nome.match(/\b(\d{1,3})[Xx]\d/);
  if (m3) return Number(m3[1]);
  return 1;
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
<det nItem="6"><prod><cProd>ANT350</cProd><cEAN>7891991010551</cEAN><xProd>CERVEJA ANTARTICA LATA 350ML FARDO 12</xProd><uCom>FD</uCom><qCom>8</qCom><vUnCom>36.00</vUnCom></prod></det>
<det nItem="7"><prod><cProd>AGU500</cProd><cEAN>7896024200013</cEAN><xProd>AGUA MINERAL CRYSTAL 500ML 6X1</xProd><uCom>PCT</uCom><qCom>20</qCom><vUnCom>12.00</vUnCom></prod></det>
</infNFe></NFe></nfeProc>`;
