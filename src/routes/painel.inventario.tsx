import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, Download,
  PlayCircle, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useEstoque, ajustarEstoque } from "@/lib/estoque-store";
import { gravarAudit } from "@/lib/audit-store";
import { useProdutos } from "@/lib/produtos-store";
import { useAuth } from "@/lib/auth";
import { HOJE } from "@/lib/computed";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/inventario")({
  head: () => ({
    meta: [{ title: "Inventário Periódico — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Inventario,
});

type Fase = "inicio" | "contagem" | "revisao" | "concluido";

type LinhaCont = {
  loteId: string;
  produtoId: string;
  nomeProd: string;
  lote: string;
  validade: string;
  local: string;
  sistemaQtd: number;
  contado: number | null;
};

function Inventario() {
  const est = useEstoque();
  const produtos = useProdutos();
  const auth = useAuth();
  const [fase, setFase] = useState<Fase>("inicio");
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("");

  const linhas = useMemo<LinhaCont[]>(() => {
    const lotesAtivos = est.lotes.filter((l) => l.qtd > 0 || l.qtd === 0);
    return lotesAtivos
      .map((l) => {
        const prod = produtos.find((p) => p.id === l.produtoId);
        return {
          loteId: l.id,
          produtoId: l.produtoId,
          nomeProd: prod?.nome ?? "Produto desconhecido",
          lote: l.lote,
          validade: l.validade,
          local: l.local,
          sistemaQtd: l.qtd,
          contado: contagens[l.id] !== undefined ? parseFloat(contagens[l.id] ?? "") || 0 : null,
        };
      })
      .sort((a, b) => a.nomeProd.localeCompare(b.nomeProd));
  }, [est.lotes, produtos, contagens]);

  const linhasFiltradas = useMemo(() => {
    if (!filtro) return linhas;
    const q = filtro.toLowerCase();
    return linhas.filter(
      (l) => l.nomeProd.toLowerCase().includes(q) || l.local.toLowerCase().includes(q) || l.lote.toLowerCase().includes(q),
    );
  }, [linhas, filtro]);

  const divergencias = useMemo(() =>
    linhas.filter((l) => l.contado !== null && l.contado !== l.sistemaQtd),
    [linhas],
  );

  const naoContados = linhas.filter((l) => l.contado === null).length;

  function iniciarInventario() {
    setContagens({});
    setFiltro("");
    setFase("contagem");
  }

  function avancarRevisao() {
    if (naoContados > 0) {
      const ok = window.confirm(`${naoContados} lote${naoContados > 1 ? "s" : ""} ainda não foi${naoContados > 1 ? "ram" : ""} contado${naoContados > 1 ? "s" : ""}. Preencher com 0 e continuar?`);
      if (!ok) return;
      const novas = { ...contagens };
      linhas.forEach((l) => {
        if (!(l.loteId in novas)) novas[l.loteId] = "0";
      });
      setContagens(novas);
    }
    setFase("revisao");
  }

  function confirmarInventario() {
    const usuario = auth.nomeProprietario ?? "Sistema";
    for (const l of linhas) {
      const contado = l.contado ?? 0;
      if (contado !== l.sistemaQtd) {
        ajustarEstoque(l.loteId, contado, "Inventário periódico", usuario);
      }
    }
    gravarAudit({ acao: "ajuste", modulo: "Inventário", descricao: `Inventário periódico concluído por ${usuario} — ${linhas.length} lote${linhas.length !== 1 ? "s" : ""} contado${linhas.length !== 1 ? "s" : ""}, ${divergencias.length} ajuste${divergencias.length !== 1 ? "s" : ""} aplicado${divergencias.length !== 1 ? "s" : ""}.`, usuarioNome: usuario });
    toast.success(`Inventário concluído — ${divergencias.length} ajuste${divergencias.length !== 1 ? "s" : ""} aplicado${divergencias.length !== 1 ? "s" : ""}.`);
    setFase("concluido");
  }

  function exportarCSV() {
    const rows = ["Produto,Lote,Validade,Local,Sistema,Contado,Diferença"];
    for (const l of linhas) {
      const contado = l.contado ?? "";
      const diff = l.contado !== null ? l.contado - l.sistemaQtd : "";
      rows.push(`"${l.nomeProd.replace(/"/g, '""')}","${l.lote}","${l.validade}","${l.local}",${l.sistemaQtd},${contado},${diff}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${HOJE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Tela inicial ────────────────────────────────────────────────────────────

  if (fase === "inicio") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inventário Periódico</h1>
            <p className="text-sm text-muted-foreground">Contagem cega para auditoria de estoque</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O inventário periódico exibe todos os lotes <strong>sem mostrar as quantidades do sistema</strong>.
            O operador conta fisicamente e registra o que encontrou. O sistema compara e aplica os ajustes.
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-semibold">{linhas.length}</p>
              <p className="text-xs text-muted-foreground">lotes para contar</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-semibold">{produtos.length}</p>
              <p className="text-xs text-muted-foreground">produtos cadastrados</p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mb-1 h-3.5 w-3.5 inline mr-1" />
            Ao confirmar o inventário, os saldos do sistema serão <strong>sobrescritos</strong> pelos valores contados.
            Essa ação não pode ser desfeita.
          </div>

          <button
            onClick={iniciarInventario}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlayCircle className="h-4 w-4" />
            Iniciar inventário
          </button>
        </div>
      </div>
    );
  }

  // ─── Tela concluído ──────────────────────────────────────────────────────────

  if (fase === "concluido") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inventário Concluído</h1>
            <p className="text-sm text-muted-foreground">{divergencias.length} ajuste{divergencias.length !== 1 ? "s" : ""} aplicado{divergencias.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          {divergencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Estoque do sistema coincidiu com a contagem física. Nenhum ajuste necessário.</p>
          ) : (
            <div className="divide-y text-sm">
              {divergencias.map((l) => (
                <div key={l.loteId} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{l.nomeProd}</p>
                    <p className="text-xs text-muted-foreground">{l.lote} · {l.local}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-3 text-right">
                    <span className="text-muted-foreground line-through">{l.sistemaQtd}</span>
                    <span className="font-semibold">{l.contado}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", (l.contado ?? 0) > l.sistemaQtd ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-destructive/10 text-destructive")}>
                      {(l.contado ?? 0) > l.sistemaQtd ? "+" : ""}{(l.contado ?? 0) - l.sistemaQtd}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={exportarCSV}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Exportar relatório CSV
            </button>
            <button
              onClick={() => { setFase("inicio"); setContagens({}); }}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" /> Novo inventário
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Tela de revisão ─────────────────────────────────────────────────────────

  if (fase === "revisao") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Revisão de Divergências</h1>
            <p className="text-sm text-muted-foreground">
              {divergencias.length === 0
                ? "Nenhuma divergência encontrada — estoque confere."
                : `${divergencias.length} lote${divergencias.length > 1 ? "s" : ""} com divergência`}
            </p>
          </div>
          <button
            onClick={() => setFase("contagem")}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Voltar para contagem
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Produto</th>
                <th className="px-4 py-3 text-left font-semibold">Lote / Local</th>
                <th className="px-4 py-3 text-right font-semibold">Sistema</th>
                <th className="px-4 py-3 text-right font-semibold">Contado</th>
                <th className="px-4 py-3 text-right font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.map((l) => {
                const cont = l.contado ?? 0;
                const diff = cont - l.sistemaQtd;
                const diverge = diff !== 0;
                return (
                  <tr key={l.loteId} className={cn(diverge && "bg-destructive/5")}>
                    <td className="max-w-[180px] truncate px-4 py-2.5 font-medium">{l.nomeProd}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.lote}<br />{l.local}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{l.sistemaQtd}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{cont}</td>
                    <td className="px-4 py-2.5 text-right">
                      {diverge ? (
                        <span className={cn("rounded px-2 py-0.5 text-xs font-bold", diff > 0 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-destructive/10 text-destructive")}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            onClick={confirmarInventario}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar e aplicar {divergencias.length} ajuste{divergencias.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    );
  }

  // ─── Tela de contagem ────────────────────────────────────────────────────────

  const contados = linhas.filter((l) => l.contado !== null).length;
  const progresso = linhas.length > 0 ? Math.round((contados / linhas.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Contagem de Estoque</h1>
          <p className="text-sm text-muted-foreground">
            {contados} / {linhas.length} lotes contados ({progresso}%)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setFase("inicio"); setContagens({}); }}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" /> Cancelar
          </button>
          <button
            onClick={avancarRevisao}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Revisar <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{contados}/{linhas.length}</span>
          </button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Busca */}
      <input
        placeholder="Filtrar por produto, lote ou local…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
      />

      {/* Tabela de contagem — sistema oculto */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Produto</th>
              <th className="px-4 py-3 text-left font-semibold">Lote / Local</th>
              <th className="px-4 py-3 text-right font-semibold w-32">Qtd contada</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhasFiltradas.map((l) => (
              <tr key={l.loteId} className={cn(l.contado !== null && "bg-green-50/40 dark:bg-green-950/20")}>
                <td className="max-w-[200px] truncate px-4 py-2 font-medium">{l.nomeProd}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {l.lote}<br />{l.local}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={contagens[l.loteId] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setContagens((prev) => ({ ...prev, [l.loteId]: v }));
                    }}
                    className="w-24 rounded border bg-background px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </td>
              </tr>
            ))}
            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum lote encontrado para "{filtro}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={avancarRevisao}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Concluir contagem e revisar
        </button>
      </div>
    </div>
  );
}
