import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, EyeOff, Package, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lotesFefo, useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { conferirReposicao, useOperacao } from "@/lib/operacao-store";
import { useAuth } from "@/lib/auth";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/reposicao")({
  head: () => ({
    meta: [
      { title: "Reposição — OmniSafe 360" },
      { name: "description", content: "Pedidos de reposição da gôndola e conferência cega do repositor." },
      { property: "og:title", content: "Reposição — OmniSafe 360" },
      { property: "og:description", content: "Reposição da gôndola com conferência cega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Reposicao,
});

const hora = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Reposicao() {
  const s = useEstoque();
  const op = useOperacao();
  const produtos = useProdutos();
  const auth = useAuth();
  const [aberto, setAberto] = useState<string | null>(null);
  const [encontrado, setEncontrado] = useState("");
  const [reposto, setReposto] = useState("");

  const pedidos = produtos
    .map((p) => {
      const naGondola = s.gondola[p.id] ?? 0;
      const deposito = lotesFefo(s, p.id).reduce((t, l) => t + l.qtd, 0);
      const cap = p.maximo && p.maximo > 0 ? p.maximo : p.minimo * 3;
      return { p, naGondola, deposito, sugestao: Math.min(deposito, Math.max(0, cap - naGondola)) };
    })
    .filter((x) => x.naGondola <= x.p.minimo);

  function abrir(id: string, sugestao: number) { setAberto(id); setEncontrado(""); setReposto(String(sugestao)); }

  function confirmar(id: string, deposito: number) {
    const enc = Number(encontrado), rep = Number(reposto);
    if (encontrado === "" || enc < 0 || rep < 0) { toast.error("Informe quanto encontrou na gôndola."); return; }
    if (rep > deposito) { toast.error(`O depósito só tem ${deposito}.`); return; }
    const bateu = conferirReposicao(id, enc, rep, auth.nomeProprietario ?? "Repositor");
    if (bateu) toast.success("Contagem bateu. Gôndola reposta.");
    else toast.warning("Contagem não bateu com o sistema. Inconsistência aberta.");
    setAberto(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reposição</h1>
        <p className="text-muted-foreground">Produtos que chegaram ao mínimo na gôndola. O repositor conta sem ver o número do sistema.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {produtos.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed bg-card py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 font-semibold">Nenhum produto cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre os produtos para ver quais precisam de reposição.</p>
            <Button asChild size="sm" className="mt-5">
              <Link to="/painel/produtos"><Package className="h-4 w-4" /> Cadastrar produtos</Link>
            </Button>
          </div>
        ) : pedidos.length === 0 && (
          <div className="col-span-full rounded-2xl border bg-card py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success/50" />
            <p className="mt-3 font-semibold">Tudo reposto!</p>
            <p className="mt-1 text-sm text-muted-foreground">Nenhum produto está abaixo do mínimo na gôndola agora.</p>
          </div>
        )}
        {pedidos.map(({ p, naGondola, deposito, sugestao }) => (
          <div key={p.id} className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-semibold">{p.nome}</p><p className="text-xs text-muted-foreground">{p.codigo}</p></div>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">Repor</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Gôndola</p><p className="font-bold">{naGondola}</p></div>
              <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Mínimo</p><p className="font-bold">{p.minimo}</p></div>
              <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Depósito</p><p className="font-bold">{deposito}</p></div>
            </div>
            {aberto === p.id ? (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-primary"><EyeOff className="h-4 w-4" />Tela do repositor: ele não vê quanto o sistema tem</p>
                <label className="block text-sm">Quantos encontrou na gôndola?
                  <Input aria-label="Encontrado na gôndola" type="number" min={0} value={encontrado} onChange={(e) => setEncontrado(e.target.value)} className="mt-1" />
                </label>
                <label className="block text-sm">Quantos colocou agora?
                  <Input aria-label="Quantidade reposta" type="number" min={0} value={reposto} onChange={(e) => setReposto(e.target.value)} className="mt-1" />
                </label>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => confirmar(p.id, deposito)}>Confirmar</Button>
                  <Button variant="outline" onClick={() => setAberto(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button className="w-full" disabled={deposito === 0} onClick={() => abrir(p.id, sugestao)}>
                <RefreshCw className="mr-2 h-4 w-4" />{deposito === 0 ? "Sem estoque no depósito" : `Conferir e repor (sugerido ${sugestao})`}
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <h2 className="border-b p-4 font-semibold">Conferências feitas</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Produto</th><th className="p-3">Sistema</th><th className="p-3">Encontrado</th><th className="p-3">Reposto</th><th className="p-3">Resultado</th></tr></thead>
          <tbody>
            {op.conferencias.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{hora(c.data)}</td>
                <td className="p-3 font-medium">{produtos.find((p) => p.id === c.produtoId)?.nome}</td>
                <td className="p-3">{c.sistema}</td><td className="p-3">{c.encontrado}</td><td className="p-3">{c.reposto}</td>
                <td className="p-3">{c.sistema === c.encontrado
                  ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />Bateu</span>
                  : <span className="flex items-center gap-1 text-destructive"><TriangleAlert className="h-4 w-4" />Diferença de {c.encontrado - c.sistema}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
