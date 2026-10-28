import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Barcode, Boxes, Check, DollarSign, Layers, ListChecks, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, categorias, UNIDADES } from "@/lib/mock-data";
import { cadastrarProduto } from "@/lib/produtos-store";
import { useFornecedores } from "@/lib/fornecedores-store";
import { inicializarProduto, registrarEntrada, executarTransferencia } from "@/lib/estoque-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/produtos/novo")({
  head: () => ({
    meta: [
      { title: "Novo produto — OmniSafe 360" },
      { name: "description", content: "Cadastre um produto passo a passo: fornecedor, preços, depósito e gôndola." },
      { property: "og:title", content: "Novo produto — OmniSafe 360" },
      { property: "og:description", content: "Cadastro de produto passo a passo no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: NovoProduto,
});

const passos = [
  { t: "Identificação", d: "O que é o produto", icon: Barcode },
  { t: "Fornecedor", d: "De quem você compra", icon: Truck },
  { t: "Unidades", d: "Como compra e vende", icon: Layers },
  { t: "Preços", d: "Custo e venda", icon: DollarSign },
  { t: "Depósito", d: "Lote e validade", icon: Warehouse },
  { t: "Gôndola", d: "Exposição e mínimo", icon: Boxes },
  { t: "Revisão", d: "Confira e salve", icon: ListChecks },
];

const inicial = {
  codigo: "", nome: "", categoria: "", marca: "",
  fornecedorId: "", novoFornecedor: false, fNome: "", fCnpj: "", fContato: "",
  unidade: "un", embalagem: "Caixa", porEmbalagem: "12",
  custo: "", venda: "",
  lote: "", validade: "", qtdDeposito: "",
  depRua: "", depPrateleira: "", depNivel: "",
  minimoDeposito: "10", maximoDeposito: "100",
  qtdGondola: "", minimo: "5", maximo: "50",
  gondCorredor: "", gondGondola: "", gondNivel: "" as "" | "Alto" | "Médio" | "Baixo", gondPosicao: "",
};

function Campo({ label, children, dica }: { label: string; children: ReactNode; dica?: string }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  );
}

const num = (s: string) => Number(s.replace(",", ".")) || 0;

function NovoProduto() {
  const navigate = useNavigate();
  const fornecedores = useFornecedores();
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(inicial);
  const set = (k: keyof typeof inicial) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const custo = num(f.custo), venda = num(f.venda);
  const margem = custo > 0 && venda > 0 ? ((venda - custo) / venda) * 100 : null;
  const fornecedorNome = f.novoFornecedor ? f.fNome : fornecedores.find((x) => x.id === f.fornecedorId)?.nome;

  const valido = [
    f.codigo.length >= 8 && f.nome.trim().length > 1 && !!f.categoria,
    f.novoFornecedor ? f.fNome.trim().length > 1 : !!f.fornecedorId,
    !!f.unidade && num(f.porEmbalagem) > 0,
    custo > 0 && venda > 0,
    f.qtdDeposito !== "",
    f.qtdGondola !== "" && num(f.minimo) > 0,
    true,
  ][step];

  const avancar = () => {
    if (step < passos.length - 1) return setStep(step + 1);

    const qtdDep = num(f.qtdDeposito);
    const qtdGond = num(f.qtdGondola);
    const total = qtdDep + qtdGond;

    const localDeposito = f.depRua && f.depPrateleira && f.depNivel
      ? { rua: f.depRua, prateleira: f.depPrateleira, nivel: Number(f.depNivel) }
      : undefined;
    const localGondola = f.gondCorredor && f.gondGondola && f.gondNivel && f.gondPosicao
      ? { corredor: f.gondCorredor, gondola: f.gondGondola, nivel: f.gondNivel as "Alto" | "Médio" | "Baixo", posicao: Number(f.gondPosicao) }
      : undefined;

    const id = cadastrarProduto({
      nome: f.nome.trim(),
      codigo: f.codigo,
      categoria: f.categoria,
      fornecedor: fornecedorNome ?? "",
      fornecedorId: f.novoFornecedor ? undefined : (f.fornecedorId || undefined),
      preco: venda,
      custoUltimaCompra: custo > 0 ? custo : undefined,
      deposito: 0,
      gondola: 0,
      minimo: num(f.minimo),
      maximo: num(f.maximo) || 0,
      minimoDeposito: num(f.minimoDeposito) || 10,
      maximoDeposito: num(f.maximoDeposito) || 100,
      validade: f.validade || undefined,
      localDeposito,
      localGondola,
      unidade: f.unidade || "un",
    });

    inicializarProduto(id);

    if (total > 0) {
      const lote = f.lote || "LOTE-INICIAL";
      const validade = f.validade || "2099-12-31";
      registrarEntrada(id, total, lote, validade, "Cadastro inicial", auth.nomeProprietario ?? "Sistema");
      if (qtdGond > 0) {
        try { executarTransferencia(id, Math.min(qtdGond, total)); } catch { /* depósito insuficiente */ }
      }
    }

    toast.success(`"${f.nome}" cadastrado com sucesso!`);
    navigate({ to: "/painel/produtos/$id", params: { id } });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/painel/produtos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Produtos</Link>
      <h1 className="text-3xl font-bold">Novo produto</h1>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <ol className="space-y-1">
          {passos.map(({ t, d, icon: Icon }, i) => (
            <li key={t}>
              <button disabled={i > step} onClick={() => setStep(i)} className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left transition", i === step ? "bg-card shadow-elegant" : "hover:bg-muted disabled:hover:bg-transparent")}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", i < step ? "bg-success text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {i < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span><span className={cn("block text-sm font-semibold", i > step && "text-muted-foreground")}>{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border bg-card p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Passo {step + 1} de {passos.length}</p>
          <h2 className="mb-6 mt-1 text-2xl font-bold">{passos[step]?.t}</h2>

          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Campo label="Código de barras" dica="Digite ou bipe com o leitor."><Input autoFocus inputMode="numeric" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.replace(/\D/g, "").slice(0, 14) })} placeholder="7891234567890" className="h-12 font-mono text-lg" /></Campo></div>
              <div className="sm:col-span-2"><Campo label="Nome do produto"><Input value={f.nome} onChange={set("nome")} placeholder="Ex.: Sabonete Lux 85g" /></Campo></div>
              <Campo label="Marca"><Input value={f.marca} onChange={set("marca")} placeholder="Ex.: Lux" /></Campo>
              <Campo label="Categoria">
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, categoria: c })} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", f.categoria === c ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}>{c}</button>)}
                </div>
              </Campo>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {fornecedores.map((x) => (
                  <button key={x.id} type="button" onClick={() => setF({ ...f, fornecedorId: x.id, novoFornecedor: false })} className={cn("rounded-xl border-2 p-4 text-left transition", !f.novoFornecedor && f.fornecedorId === x.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40")}>
                    <p className="font-semibold">{x.nome}</p><p className="font-mono text-xs text-muted-foreground">{x.cnpj}</p>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setF({ ...f, novoFornecedor: true, fornecedorId: "" })} className={cn("w-full rounded-xl border-2 border-dashed p-4 text-sm font-semibold", f.novoFornecedor ? "border-primary text-primary" : "text-muted-foreground hover:border-primary/40")}>+ Cadastrar novo fornecedor aqui</button>
              {f.novoFornecedor && (
                <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
                  <Campo label="Nome"><Input value={f.fNome} onChange={set("fNome")} /></Campo>
                  <Campo label="CNPJ"><Input value={f.fCnpj} onChange={set("fCnpj")} /></Campo>
                  <Campo label="Telefone / e-mail"><Input value={f.fContato} onChange={set("fContato")} /></Campo>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Campo label="Vende por (unidade de medida)">
                  <div className="flex flex-wrap gap-1.5">
                    {UNIDADES.map((u) => (
                      <button key={u} type="button" onClick={() => setF({ ...f, unidade: u })}
                        className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold transition", f.unidade === u ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50")}>
                        {u}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {f.unidade === "kg" || f.unidade === "g" || f.unidade === "L" || f.unidade === "mL" || f.unidade === "m" || f.unidade === "m²"
                      ? "⚖️ Unidade fracionada — o PDV aceitará quantidades decimais (ex.: 1,350 kg)"
                      : "📦 Unidade inteira — o PDV usará quantidades inteiras"}
                  </p>
                </Campo>
              </div>
              <Campo label="Compra em"><Input value={f.embalagem} onChange={set("embalagem")} placeholder="Caixa, Fardo, Pack" /></Campo>
              <Campo label={`${f.unidade} por ${f.embalagem.toLowerCase() || "embalagem"}`}><Input inputMode="numeric" value={f.porEmbalagem} onChange={set("porEmbalagem")} /></Campo>
              <div className="rounded-xl bg-secondary p-4 text-sm sm:col-span-3">Conversão: <strong>1 {f.embalagem || "embalagem"} = {num(f.porEmbalagem)} {f.unidade}</strong>. É usada na conferência do recebimento.</div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label={`Custo por ${f.unidade} (R$)`}><Input inputMode="decimal" value={f.custo} onChange={set("custo")} placeholder="0,00" className="h-12 text-lg" /></Campo>
              <Campo label={`Preço de venda (R$)`}><Input inputMode="decimal" value={f.venda} onChange={set("venda")} placeholder="0,00" className="h-12 text-lg" /></Campo>
              <div className={cn("rounded-xl p-4 sm:col-span-2", margem === null ? "bg-muted" : margem < 10 ? "bg-destructive/10" : "bg-success/12")}>
                <p className="text-sm text-muted-foreground">Margem calculada</p>
                <p className="font-display text-2xl font-bold">{margem === null ? "—" : `${margem.toFixed(1)}%`}</p>
                {margem !== null && <p className="text-xs text-muted-foreground">Lucro de {brl(venda - custo)} por {f.unidade}</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Lote" dica="Opcional para produtos sem vencimento."><Input value={f.lote} onChange={set("lote")} placeholder="Ex.: L2310A" className="font-mono" /></Campo>
              <Campo label="Data de validade" dica="Deixe em branco para produtos sem vencimento."><Input type="date" value={f.validade} onChange={set("validade")} /></Campo>
              <Campo label={`Quantidade no depósito (${f.unidade})`}><Input inputMode="numeric" value={f.qtdDeposito} onChange={set("qtdDeposito")} placeholder="0" /></Campo>
              <Campo label="Mínimo no depósito" dica="Alerta quando cair abaixo desse valor."><Input inputMode="numeric" value={f.minimoDeposito} onChange={(e) => setF({ ...f, minimoDeposito: e.target.value.replace(/\D/g, "") })} placeholder="10" /></Campo>
              <Campo label="Máximo no depósito" dica="Capacidade total do depósito para este produto."><Input inputMode="numeric" value={f.maximoDeposito} onChange={(e) => setF({ ...f, maximoDeposito: e.target.value.replace(/\D/g, "") })} placeholder="100" /></Campo>
              <div className="sm:col-span-2">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">Localização no depósito <span className="font-normal">(opcional)</span></p>
                <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
                  <Campo label="Rua"><Input value={f.depRua} onChange={set("depRua")} placeholder="Ex.: A" /></Campo>
                  <Campo label="Prateleira"><Input value={f.depPrateleira} onChange={set("depPrateleira")} placeholder="Ex.: B3" /></Campo>
                  <Campo label="Nível (número)"><Input inputMode="numeric" value={f.depNivel} onChange={(e) => setF({ ...f, depNivel: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 2" /></Campo>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <Campo label="Vai para a gôndola agora"><Input inputMode="numeric" value={f.qtdGondola} onChange={set("qtdGondola")} placeholder="0" /></Campo>
                <Campo label="Estoque mínimo" dica="Ao chegar aqui, o repositor é avisado."><Input inputMode="numeric" value={f.minimo} onChange={set("minimo")} placeholder="10" /></Campo>
                <Campo label="Capacidade máxima"><Input inputMode="numeric" value={f.maximo} onChange={set("maximo")} placeholder="40" /></Campo>
              </div>
              {num(f.minimo) > 0 && (
                <div className="rounded-xl bg-warning/15 p-4 text-sm">
                  Exemplo: com {num(f.qtdGondola) || 20} na gôndola, depois de vender {Math.max(0, (num(f.qtdGondola) || 20) - num(f.minimo))} unidades o PDV avisa o repositor para repor{num(f.maximo) ? ` até ${num(f.maximo)}` : ""}.
                </div>
              )}
              <div>
                <p className="mb-3 text-sm font-semibold text-muted-foreground">Localização na gôndola <span className="font-normal">(opcional)</span></p>
                <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-4">
                  <Campo label="Corredor"><Input value={f.gondCorredor} onChange={set("gondCorredor")} placeholder="Ex.: 3" /></Campo>
                  <Campo label="Gôndola"><Input value={f.gondGondola} onChange={set("gondGondola")} placeholder="Ex.: G2" /></Campo>
                  <Campo label="Nível">
                    <div className="flex gap-1.5">
                      {(["Alto", "Médio", "Baixo"] as const).map((n) => (
                        <button key={n} type="button" onClick={() => setF({ ...f, gondNivel: n })}
                          className={cn("flex-1 rounded-lg border py-2 text-xs font-semibold", f.gondNivel === n ? "border-primary bg-primary text-primary-foreground" : "")}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </Campo>
                  <Campo label="Posição"><Input inputMode="numeric" value={f.gondPosicao} onChange={(e) => setF({ ...f, gondPosicao: e.target.value.replace(/\D/g, "") })} placeholder="Ex.: 4" /></Campo>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {[
                ["Produto", `${f.nome} (${f.marca || "sem marca"})`],
                ["Código", f.codigo],
                ["Categoria", f.categoria],
                ["Fornecedor", fornecedorNome],
                ["Conversão", `1 ${f.embalagem} = ${f.porEmbalagem} ${f.unidade}`],
                ["Custo / venda", `${brl(custo)} → ${brl(venda)}`],
                ["Lote / validade", `${f.lote} · ${f.validade.split("-").reverse().join("/")}`],
                ["Depósito", `${f.qtdDeposito} ${f.unidade}`],
                ["Depósito — mín./máx.", `mín. ${num(f.minimoDeposito)} · máx. ${num(f.maximoDeposito)}`],
                ["Local depósito", f.depRua ? `Rua ${f.depRua} · Prat. ${f.depPrateleira} · Nív. ${f.depNivel}` : "Não informado"],
                ["Gôndola", `${f.qtdGondola} · mín. ${f.minimo}${f.maximo ? ` · máx. ${f.maximo}` : ""}`],
                ["Local gôndola", f.gondCorredor ? `Corr. ${f.gondCorredor} · ${f.gondGondola} · ${f.gondNivel} · Pos. ${f.gondPosicao}` : "Não informado"],
              ].map(([k, v]) => (
                <div key={k} className="border-b pb-3"><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
              ))}
            </dl>
          )}

          <div className="mt-8 flex justify-between border-t pt-6">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft /> Voltar</Button>
            <Button size="lg" disabled={!valido} onClick={avancar}>{step < passos.length - 1 ? "Continuar" : "Salvar produto"} {step < passos.length - 1 ? <ArrowRight /> : <Check />}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
