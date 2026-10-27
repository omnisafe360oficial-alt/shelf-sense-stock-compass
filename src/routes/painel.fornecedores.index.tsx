import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown, Building2, Mail, MapPin, Phone, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFornecedores, cadastrarFornecedor } from "@/lib/fornecedores-store";
import { useProdutos } from "@/lib/produtos-store";
import { usePedidos } from "@/lib/pedidos-store";
import { brl } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/fornecedores/")({
  head: () => ({
    meta: [
      { title: "Fornecedores — OmniSafe 360" },
      { name: "description", content: "Todos os fornecedores da loja, com contatos e produtos fornecidos." },
      { property: "og:title", content: "Fornecedores — OmniSafe 360" },
      { property: "og:description", content: "Todos os fornecedores da loja no OmniSafe 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fornecedores,
});

const FORM_VAZIO = { nome: "", cnpj: "", contato: "", telefone: "", email: "", cidade: "", prazo: "" };
type Sort = "az" | "produtos" | "pedidos";

function Fornecedores() {
  const fornecedores = useFornecedores();
  const produtos = useProdutos();
  const { pedidos } = usePedidos();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("az");
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const sf = (k: keyof typeof FORM_VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const produtosPorFornecedor = useMemo(
    () => Object.fromEntries(fornecedores.map((f) => [f.id, produtos.filter((p) => p.fornecedor === f.nome).length])),
    [fornecedores, produtos],
  );
  const pedidosPorFornecedor = useMemo(
    () => Object.fromEntries(fornecedores.map((f) => [f.id, pedidos.filter((p) => p.fornecedorId === f.id)])),
    [fornecedores, pedidos],
  );

  const cidades = useMemo(() => new Set(fornecedores.map((f) => f.cidade).filter(Boolean)).size, [fornecedores]);
  const totalProdutos = useMemo(() => produtos.length, [produtos]);

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    let filtrado = t
      ? fornecedores.filter((f) => f.nome.toLowerCase().includes(t) || f.cnpj.includes(t) || f.cidade.toLowerCase().includes(t))
      : [...fornecedores];
    if (sort === "az") filtrado.sort((a, b) => a.nome.localeCompare(b.nome));
    if (sort === "produtos") filtrado.sort((a, b) => (produtosPorFornecedor[b.id] ?? 0) - (produtosPorFornecedor[a.id] ?? 0));
    if (sort === "pedidos") filtrado.sort((a, b) => (pedidosPorFornecedor[b.id]?.length ?? 0) - (pedidosPorFornecedor[a.id]?.length ?? 0));
    return filtrado;
  }, [q, sort, fornecedores, produtosPorFornecedor, pedidosPorFornecedor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">{fornecedores.length} fornecedor{fornecedores.length !== 1 ? "es" : ""} cadastrado{fornecedores.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="lg" onClick={() => { setForm(FORM_VAZIO); setNovo(true); }}>
          <Plus /> Novo fornecedor
        </Button>
      </div>

      {/* Stats */}
      {fornecedores.length > 0 && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
          {[
            { l: "Fornecedores", v: fornecedores.length },
            { l: "Cidades", v: cidades },
            { l: "Produtos", v: totalProdutos },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-xl border bg-card px-5 py-4 text-center">
              <p className="text-2xl font-bold">{v}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou cidade"
            className="h-10 pl-9"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          {(["az", "produtos", "pedidos"] as Sort[]).map((s) => {
            const labels: Record<Sort, string> = { az: "A–Z", produtos: "Produtos", pedidos: "Pedidos" };
            return (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  sort === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {fornecedores.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card py-20 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-semibold">Nenhum fornecedor cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro fornecedor para vinculá-lo a pedidos de compra.</p>
          <Button className="mt-5" onClick={() => { setForm(FORM_VAZIO); setNovo(true); }}>
            <Plus /> Novo fornecedor
          </Button>
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
          <p className="font-semibold">Nenhum resultado para "{q}"</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outro nome, CNPJ ou cidade.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((f) => {
            const qtdProd = produtosPorFornecedor[f.id] ?? 0;
            const peds = pedidosPorFornecedor[f.id] ?? [];
            const pendentes = peds.filter((p) => ["enviado", "confirmado", "parcial"].includes(p.status)).length;
            const totalPeds = peds.reduce((s, p) => s + p.total, 0);
            const contatos = [
              f.telefone && { icon: Phone, v: f.telefone },
              f.email && { icon: Mail, v: f.email },
              f.cidade && { icon: MapPin, v: f.cidade },
            ].filter(Boolean) as { icon: typeof Phone; v: string }[];
            return (
              <Link
                key={f.id}
                to="/painel/fornecedores/$id"
                params={{ id: f.id }}
                className="group rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elegant"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand font-display text-lg font-bold text-primary-foreground">
                    {f.nome[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold group-hover:text-primary">{f.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{f.cnpj || "—"}</p>
                  </div>
                  {pendentes > 0 && (
                    <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                      {pendentes} em aberto
                    </span>
                  )}
                </div>

                {contatos.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {contatos.map(({ icon: Icon, v }) => (
                      <p key={v} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{v}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                  <span>
                    <strong>{qtdProd}</strong>{" "}
                    <span className="text-muted-foreground">produto{qtdProd !== 1 ? "s" : ""}</span>
                  </span>
                  <span>
                    {totalPeds > 0 ? (
                      <span className="text-muted-foreground">{brl(totalPeds)} em pedidos</span>
                    ) : (
                      <span className="text-muted-foreground">Prazo {f.prazo || "—"}</span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal novo fornecedor */}
      {novo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setNovo(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.nome.trim()) { toast.error("Nome é obrigatório."); return; }
              cadastrarFornecedor({ ...form, nome: form.nome.trim() });
              setNovo(false);
              toast.success(`Fornecedor "${form.nome.trim()}" cadastrado!`);
            }}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-8 shadow-elegant"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Novo fornecedor</h2>
              <button type="button" onClick={() => setNovo(false)} aria-label="Fechar">
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              <Label>Nome / razão social <span className="text-destructive">*</span></Label>
              <Input required value={form.nome} onChange={sf("nome")} placeholder="Ex.: Distribuidora ABC" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ / CPF</Label>
                <Input value={form.cnpj} onChange={sf("cnpj")} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>Nome do contato</Label>
                <Input value={form.contato} onChange={sf("contato")} placeholder="Ex.: João Silva" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={sf("telefone")} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={sf("email")} placeholder="pedidos@empresa.com.br" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={sf("cidade")} placeholder="São Paulo · SP" />
              </div>
              <div className="space-y-2">
                <Label>Prazo de pagamento</Label>
                <Input value={form.prazo} onChange={sf("prazo")} placeholder="28 dias" />
              </div>
            </div>
            <Button type="submit" className="h-11 w-full">Salvar fornecedor</Button>
          </form>
        </div>
      )}
    </div>
  );
}
