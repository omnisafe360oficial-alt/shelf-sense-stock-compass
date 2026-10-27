import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, FileCode2, FileUp, MapPin, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/mock-data";
import { getConfig } from "@/lib/config-store";
import { getProdutos, cadastrarProduto, editarProduto } from "@/lib/produtos-store";
import { getFornecedores, cadastrarFornecedor } from "@/lib/fornecedores-store";
import { inicializarProduto, registrarEntrada } from "@/lib/estoque-store";
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
  semValidade: boolean; loteAuto: boolean;
};

function Importar() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nota, setNota] = useState<Nfe | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [localDeposito, setLocalDeposito] = useState("Depósito");

  const carregar = (xml: string) => {
    try {
      const n = lerNfe(xml);
      setNota(n);
      setLinhas(n.itens.map((i, idx) => {
        const conv = sugerirConversao(i.nome, i.unidadeCompra);
        const custoUnit = i.custoUnitCompra / conv;
        const ex = getProdutos().find((p) => p.codigo === i.codigo);
        const cfg = getConfig();
        const vendaSugerida = custoUnit > 0
          ? (custoUnit * (1 + cfg.margemPadrao / 100)).toFixed(2)
          : "";
        const semRastro = !i.lote && !i.validade;
        return {
          codigo: i.codigo, nome: ex?.nome ?? i.nome, existente: !!ex, unidadeCompra: i.unidadeCompra, qtdCompra: i.qtdCompra,
          porEmbalagem: conv, custoUnit,
          venda: ex ? ex.preco.toFixed(2) : vendaSugerida,
          minimo: ex ? String(ex.minimo) : String(cfg.minimoPadrao),
          lote: i.lote ?? `NF-${n.numero}-${idx + 1}`,
          validade: i.validade ?? "2099-12-31",
          semValidade: semRastro,
          loteAuto: !i.lote,
        };
      }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const lerArquivo = (f?: File) => f && f.text().then(carregar);
  const upd = (i: number, k: keyof Linha, v: string | number | boolean) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const fornecedorExiste = nota && getFornecedores().some((f) => f.cnpj === nota.fornecedor.cnpj);
  const pendentes = linhas.filter((l) => !l.minimo || !l.venda || Number(l.venda) <= 0).length;

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
        <div className="flex flex-col items-end gap-2">
          {pendentes > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {pendentes} {pendentes === 1 ? "produto precisa" : "produtos precisam"} de preço de venda
            </p>
          )}
          <Button size="lg" variant={pendentes > 0 ? "outline" : "default"} onClick={() => {
            if (!nota) return;
            if (!fornecedorExiste) {
              cadastrarFornecedor({ nome: nota.fornecedor.nome, cnpj: nota.fornecedor.cnpj, contato: "", telefone: "", email: "", cidade: "", prazo: "" });
            }
            linhas.forEach((l) => {
              const qtdTotal = l.qtdCompra * l.porEmbalagem;
              if (l.existente) {
                const p = getProdutos().find((x) => x.codigo === l.codigo);
                if (p && qtdTotal > 0) {
                  editarProduto(p.id, { custoUltimaCompra: l.custoUnit });
                  registrarEntrada(p.id, qtdTotal, l.lote, l.validade, nota.numero, "Importação XML", localDeposito);
                }
              } else {
                const novoProd: Parameters<typeof cadastrarProduto>[0] = { nome: l.nome, codigo: l.codigo, categoria: "Outros", fornecedor: nota.fornecedor.nome, preco: Number(l.venda) || 0, deposito: 0, gondola: 0, minimo: Number(l.minimo) || 0, custoUltimaCompra: l.custoUnit };
                if (!l.semValidade && l.validade) novoProd.validade = l.validade;
                const id = cadastrarProduto(novoProd);
                inicializarProduto(id);
                if (qtdTotal > 0) {
                  registrarEntrada(id, qtdTotal, l.lote, l.validade, nota.numero, "Importação XML", localDeposito);
                }
              }
            });
            const semPreco = linhas.filter((l) => Number(l.venda) <= 0).length;
            if (semPreco > 0) {
              toast.success(`${linhas.length} produtos importados. Complete o preço de ${semPreco} produto(s) na lista.`);
            } else {
              toast.success(`${linhas.length} produtos importados para o depósito!`);
            }
            navigate({ to: "/painel/produtos" });
          }}>
            {pendentes > 0 ? <><AlertTriangle className="h-4 w-4" /> Importar assim mesmo</> : <><Check className="h-4 w-4" /> Confirmar importação</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5 md:col-span-2">
          <Truck className="h-5 w-5 text-primary" />
          <div className="min-w-0"><p className="truncate font-semibold">{nota.fornecedor.nome}</p><p className="text-xs text-muted-foreground">{nota.fornecedor.cnpj} · {fornecedorExiste ? "já cadastrado" : "será cadastrado"}</p></div>
        </div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs uppercase text-muted-foreground">Novos / existentes</p><p className="font-display text-2xl font-bold">{linhas.filter((l) => !l.existente).length} / {linhas.filter((l) => l.existente).length}</p></div>
        <div className={cn("rounded-2xl border p-5", pendentes ? "bg-warning/15" : "bg-success/12")}><p className="text-xs uppercase text-muted-foreground">Faltando completar</p><p className="font-display text-2xl font-bold">{pendentes ? `${pendentes} itens` : "Tudo pronto"}</p></div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="whitespace-nowrap text-sm font-medium">Local no depósito</span>
        <Input className="h-8 max-w-56" placeholder="Ex: Prateleira A-3, Câmara Fria" value={localDeposito} onChange={(e) => setLocalDeposito(e.target.value)} />
        <p className="text-xs text-muted-foreground">Onde esses produtos serão guardados (aplica a todos os lotes desta nota)</p>
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
                  <div className="mb-1 flex flex-wrap gap-1">
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", l.existente ? "bg-secondary text-primary" : "bg-success/12 text-success")}>{l.existente ? "Já existe · soma estoque" : "Novo"}</span>
                    {(!l.venda || !l.minimo) && (
                      <span className="inline-block rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">Completar dados</span>
                    )}
                  </div>
                  <p className="font-semibold">{l.nome}</p><p className="font-mono text-xs text-muted-foreground">{l.codigo}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5"><span>{l.qtdCompra} {l.unidadeCompra} ×</span>
                    <Input className="h-8 w-16" inputMode="numeric" value={l.porEmbalagem} onChange={(e) => { const n = Number(e.target.value) || 1; upd(i, "porEmbalagem", n); }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-primary">= {l.qtdCompra * l.porEmbalagem} un no depósito</p>
                </td>
                <td className="px-4 py-3 font-medium">{brl(l.custoUnit)}</td>
                <td className="px-4 py-3"><Input className={cn("h-8 w-24", !l.venda && "border-warning")} value={l.venda} onChange={(e) => upd(i, "venda", e.target.value)} /></td>
                <td className="px-4 py-3"><Input className={cn("h-8 w-20", !l.minimo && "border-warning")} placeholder="?" value={l.minimo} onChange={(e) => upd(i, "minimo", e.target.value.replace(/\D/g, ""))} /></td>
                <td className="px-4 py-3">
                  {(l.loteAuto || l.semValidade) && (
                    <span className="mb-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {l.semValidade ? "Sem lote/validade · auto" : "Lote automático"}
                    </span>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Input className="h-8 w-24 font-mono text-xs" placeholder="Lote" value={l.lote} onChange={(e) => upd(i, "lote", e.target.value)} />
                    {l.semValidade ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Sem validade</span>
                        <button type="button" className="text-[10px] text-primary underline" onClick={() => { upd(i, "semValidade", false); upd(i, "validade", ""); }}>Definir</button>
                      </div>
                    ) : (
                      <Input className="h-8 w-36" type="date" value={l.validade} onChange={(e) => upd(i, "validade", e.target.value)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><FileCode2 className="h-4 w-4" />O preço de venda sugerido usa a margem padrão ({getConfig().margemPadrao}%) configurada em Configurações. A conversão foi lida do nome do produto; ajuste se precisar.</p>
    </div>
  );
}
