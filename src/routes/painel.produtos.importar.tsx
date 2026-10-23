import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, FileCode2, FileUp, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, fornecedores } from "@/lib/mock-data";
import { getProdutos } from "@/lib/produtos-store";
import { lerNfe, sugerirConversao, XML_EXEMPLO, type Nfe } from "@/lib/nfe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/produtos/importar")({
  head: () => ({
    meta: [
      { title: "Importar XML — OmniSafe 360" },
      { name: "description", content: "Cadastre produtos em massa a partir do XML da nota fiscal (NF-e)." },
      { property: "og:title", content: "Importar XML — OmniSafe 360" },
      { property: "og:description", content: "Cadastro em massa por XML da NF-e no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Importar,
});

type Linha = {
  codigo: string; nome: string; existente: boolean; unidadeCompra: string; qtdCompra: number;
  porEmbalagem: number; custoUnit: number; venda: string; minimo: string; lote: string; validade: string;
};

function Importar() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState<Nfe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const carregar = (xml: string) => {
    try {
      const n = lerNfe(xml);
      setNota(n);
      setLinhas(n.itens.map((i) => {
        const conv = sugerirConversao(i.nome, i.unidadeCompra);
        const custoUnit = i.custoUnitCompra / conv;
        const ex = getProdutos().find((p) => p.codigo === i.codigo);
        return {
          codigo: i.codigo, nome: ex?.nome ?? i.nome, existente: !!ex, unidadeCompra: i.unidadeCompra, qtdCompra: i.qtdCompra,
          porEmbalagem: conv, custoUnit, venda: ex ? ex.preco.toFixed(2) : (custoUnit * 1.45).toFixed(2),
          minimo: ex ? String(ex.minimo) : "", lote: i.lote ?? "", validade: i.validade ?? "",
        };
      }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const lerArquivo = (f?: File) => f && f.text().then(carregar);
  const upd = (i: number, k: keyof Linha, v: string | number) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const fornecedorExiste = nota && fornecedores.some((f) => f.cnpj === nota.fornecedor.cnpj);
  const pendentes = linhas.filter((l) => !l.minimo || !l.venda).length;

  if (!nota) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/painel/produtos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Produtos</Link>
        <div><h1 className="text-3xl font-bold">Importar produtos por XML</h1><p className="text-muted-foreground">Envie o XML da nota fiscal. O sistema lê fornecedor, produtos, quantidades, custos e lotes.</p></div>
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); lerArquivo(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed bg-card p-16 text-center transition", arrastando ? "border-primary bg-secondary" : "hover:border-primary/50")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground"><FileUp className="h-7 w-7" /></span>
          <p className="mt-5 text-lg font-semibold">Arraste o arquivo XML aqui</p>
          <p className="text-sm text-muted-foreground">ou clique para escolher no computador</p>
          <input ref={inputRef} type="file" accept=".xml,text/xml" className="hidden" onChange={(e) => lerArquivo(e.target.files?.[0])} />
        </div>
        <div className="text-center"><Button variant="outline" onClick={() => carregar(XML_EXEMPLO)}><Sparkles /> Testar com uma nota de exemplo</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => setNota(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Trocar arquivo</button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Conferir importação</h1><p className="text-muted-foreground">NF-e nº {nota.numero} · emitida em {nota.emissao.split("-").reverse().join("/")}</p></div>
        <Button size="lg" disabled={pendentes > 0} onClick={() => { toast.success(`${linhas.length} produtos importados para o depósito!`); navigate({ to: "/painel/produtos" }); }}>
          <Check /> Confirmar importação
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 md:col-span-2">
          <Truck className="h-5 w-5 text-primary" />
          <div className="min-w-0"><p className="truncate font-semibold">{nota.fornecedor.nome}</p><p className="text-xs text-muted-foreground">{nota.fornecedor.cnpj} · {fornecedorExiste ? "já cadastrado" : "será cadastrado"}</p></div>
        </div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs uppercase text-muted-foreground">Novos / existentes</p><p className="font-display text-2xl font-bold">{linhas.filter((l) => !l.existente).length} / {linhas.filter((l) => l.existente).length}</p></div>
        <div className={cn("rounded-2xl border p-5", pendentes ? "bg-warning/15" : "bg-success/12")}><p className="text-xs uppercase text-muted-foreground">Faltando completar</p><p className="font-display text-2xl font-bold">{pendentes ? `${pendentes} itens` : "Tudo pronto"}</p></div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Compra → unidades</th><th className="px-4 py-3">Custo un.</th><th className="px-4 py-3">Venda (R$)</th><th className="px-4 py-3">Mín. gôndola</th><th className="px-4 py-3">Lote / validade</th></tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((l, i) => (
              <tr key={l.codigo} className="align-top">
                <td className="px-4 py-3">
                  <span className={cn("mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", l.existente ? "bg-secondary text-primary" : "bg-success/12 text-success")}>{l.existente ? "Já existe · soma estoque" : "Novo"}</span>
                  <p className="font-semibold">{l.nome}</p><p className="font-mono text-xs text-muted-foreground">{l.codigo}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5"><span>{l.qtdCompra} {l.unidadeCompra} ×</span>
                    <Input className="h-8 w-16" inputMode="numeric" value={l.porEmbalagem} onChange={(e) => { const n = Number(e.target.value) || 1; upd(i, "porEmbalagem", n); }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-primary">= {l.qtdCompra * l.porEmbalagem} un no depósito</p>
                </td>
                <td className="px-4 py-3 font-medium">{brl(l.custoUnit)}</td>
                <td className="px-4 py-3"><Input className="h-8 w-24" value={l.venda} onChange={(e) => upd(i, "venda", e.target.value)} /></td>
                <td className="px-4 py-3"><Input className={cn("h-8 w-20", !l.minimo && "border-warning")} placeholder="?" value={l.minimo} onChange={(e) => upd(i, "minimo", e.target.value.replace(/\D/g, ""))} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Input className="h-8 w-24 font-mono text-xs" placeholder="Lote" value={l.lote} onChange={(e) => upd(i, "lote", e.target.value)} />
                    <Input className="h-8 w-36" type="date" value={l.validade} onChange={(e) => upd(i, "validade", e.target.value)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileCode2 className="h-4 w-4" />O preço de venda sugerido usa margem de 45%. A conversão foi lida do nome do produto; ajuste se precisar.</p>
    </div>
  );
}
