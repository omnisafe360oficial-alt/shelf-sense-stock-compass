import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, Clock, Copy, Search, Share2 } from "lucide-react";
import { useRecebeEstado, type Recebimento } from "@/lib/recebe-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe/historico")({ component: RecebeHistorico });

function dataRelativa(iso: string) {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffH < 1) return "Agora há pouco";
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD === 1) return `Ontem ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffD <= 7) return `${diffD} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function gerarTextoCompartilhamento(rec: Recebimento) {
  const data = new Date(rec.data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const linhasItens = rec.itens
    .map((i) => {
      let linha = `• ${i.produtoNome} — ${i.qtdContada} ${i.unidade}`;
      if (i.fator !== 1) linha += ` (${i.qtdUN} UN)`;
      if (i.lote) linha += ` Lote ${i.lote}`;
      if (i.validade)
        linha += ` Val. ${new Date(i.validade + "T12:00:00").toLocaleDateString("pt-BR")}`;
      return linha;
    })
    .join("\n");

  return [
    `✅ *Recebimento OmniSafe Recebe*`,
    `📅 ${data}`,
    `🏭 Fornecedor: ${rec.fornecedor || "Avulso"}`,
    `👤 Operador: ${rec.operador}`,
    ``,
    `📦 *Itens recebidos:*`,
    linhasItens,
    ``,
    rec.totalDivergencias > 0
      ? `⚠️ *Divergências:* ${rec.totalDivergencias} item(s)`
      : `✔️ Sem divergências`,
    ``,
    `📲 Registrado no OmniSafe 360`,
  ].join("\n");
}

function RecebeHistorico() {
  const { recebimentos } = useRecebeEstado();
  const [busca, setBusca] = useState("");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const filtrados = busca
    ? recebimentos.filter(
        (r) =>
          r.fornecedor.toLowerCase().includes(busca.toLowerCase()) ||
          (r.pedidoNumero ?? "").toLowerCase().includes(busca.toLowerCase()),
      )
    : recebimentos;

  const recDetalhe = detalheId ? recebimentos.find((r) => r.id === detalheId) : null;

  async function compartilhar(rec: Recebimento) {
    const texto = gerarTextoCompartilhamento(rec);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback: select textarea
    }
  }

  if (recDetalhe) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setDetalheId(null)} className="text-muted-foreground" aria-label="Voltar">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <div>
              <h1 className="font-display text-base font-semibold text-foreground">{recDetalhe.fornecedor || "Avulso"}</h1>
              <p className="text-xs text-muted-foreground">{dataRelativa(recDetalhe.data)}</p>
            </div>
          </div>
          <button
            onClick={() => compartilhar(recDetalhe)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground active:bg-muted"
          >
            {copiado ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" />
                <span className="text-success">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {/* Resumo */}
          <div
            className="rounded-xl p-4 text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-semibold">{recDetalhe.itens.length} produtos</p>
                <p className="text-xs opacity-70">{recDetalhe.operador}</p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    recDetalhe.totalDivergencias > 0 ? "text-warning" : "text-white",
                  )}
                >
                  {recDetalhe.totalDivergencias > 0
                    ? `⚠️ ${recDetalhe.totalDivergencias} divergência(s)`
                    : "✓ Sem divergências"}
                </p>
                {recDetalhe.pedidoNumero && (
                  <p className="font-mono text-xs opacity-70">{recDetalhe.pedidoNumero}</p>
                )}
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Itens recebidos</p>
            {recDetalhe.itens.map((item) => {
              const temDiv =
                item.qtdEsperada !== undefined && Math.abs(item.qtdUN - item.qtdEsperada) > 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-3",
                    temDiv ? "border-destructive/20 bg-destructive/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {temDiv ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.produtoNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qtdContada} {item.unidade}
                        {item.fator !== 1 && ` = ${item.qtdUN} UN`}
                        {item.lote && ` · Lote ${item.lote}`}
                        {item.validade &&
                          ` · Val. ${new Date(item.validade + "T12:00:00").toLocaleDateString("pt-BR")}`}
                      </p>
                      {temDiv && item.qtdEsperada !== undefined && (
                        <p className="text-xs text-destructive">
                          Esperado {item.qtdEsperada} UN · Diferença:{" "}
                          {item.qtdUN - item.qtdEsperada > 0 ? "+" : ""}
                          {item.qtdUN - item.qtdEsperada}
                        </p>
                      )}
                      {item.observacao && (
                        <p className="text-xs italic text-muted-foreground">"{item.observacao}"</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {recDetalhe.observacaoGeral && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Observação geral</p>
              <p className="mt-1 text-sm text-foreground">{recDetalhe.observacaoGeral}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h1 className="font-display text-base font-semibold text-foreground">Histórico</h1>
        </div>
      </div>

      {/* Busca */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {busca ? "Nenhum resultado encontrado" : "Nenhum recebimento registrado ainda"}
            </p>
          </div>
        ) : (
          filtrados.map((r) => (
            <button
              key={r.id}
              onClick={() => setDetalheId(r.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left active:bg-muted transition-colors"
              style={{ boxShadow: "0 8px 24px -8px color-mix(in oklab, oklch(0.24 0.06 230) 12%, transparent)" }}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  r.totalDivergencias > 0 ? "bg-warning/10" : "bg-success/10",
                )}
              >
                {r.totalDivergencias > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                ) : (
                  <Check className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.fornecedor || "Avulso"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.itens.length} produto{r.itens.length !== 1 ? "s" : ""} ·{" "}
                  {r.totalDivergencias > 0
                    ? `${r.totalDivergencias} divergência(s)`
                    : "sem divergências"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-right">
                <span className="text-xs text-muted-foreground">{dataRelativa(r.data)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
