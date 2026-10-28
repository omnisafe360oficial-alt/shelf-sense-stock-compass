import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ClipboardList, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuditLog, type AuditEntry } from "@/lib/audit-store";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — OmniSafe 360" },
      { name: "description", content: "Histórico de todas as ações realizadas no sistema." },
      { property: "og:title", content: "Auditoria — OmniSafe 360" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Auditoria,
});

const MODULOS = ["Todos", "Produtos", "PDV", "Estoque", "Configurações"];
const ACOES = ["Todas", "criar", "editar", "excluir", "venda", "ajuste", "entrada"];

const BADGE: Record<string, string> = {
  criar: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  editar: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  excluir: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  venda: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  ajuste: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  entrada: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

function formatData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const badge = BADGE[entry.acao] ?? "bg-muted text-muted-foreground";
  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badge}`}>
          {entry.acao}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{entry.descricao}</p>
        {(entry.valorAnterior || entry.valorNovo) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.valorAnterior && <span className="line-through mr-1">{entry.valorAnterior}</span>}
            {entry.valorNovo && <span className="text-foreground">{entry.valorNovo}</span>}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span>{formatData(entry.data)}</span>
          {entry.usuarioNome && <span>· {entry.usuarioNome}</span>}
          {entry.modulo && <span>· {entry.modulo}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Auditoria() {
  const log = useAuditLog();
  const [busca, setBusca] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [acao, setAcao] = useState("Todas");

  const filtrado = useMemo(() => {
    return log.filter((e) => {
      if (modulo !== "Todos" && e.modulo !== modulo) return false;
      if (acao !== "Todas" && e.acao !== acao) return false;
      if (busca.length >= 2) {
        const q = busca.toLowerCase();
        return (
          e.descricao.toLowerCase().includes(q) ||
          (e.produtoNome?.toLowerCase().includes(q) ?? false) ||
          (e.usuarioNome?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [log, busca, modulo, acao]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Log de Auditoria</h1>
          <p className="text-sm text-muted-foreground">Histórico imutável de ações no sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, produto ou usuário…"
            className="pl-9 h-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={modulo}
            onChange={(e) => setModulo(e.target.value)}
          >
            {MODULOS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={acao}
            onChange={(e) => setAcao(e.target.value)}
          >
            {ACOES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border bg-card px-6 py-2">
        {filtrado.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {log.length === 0 ? "Nenhum evento registrado ainda." : "Nenhum evento corresponde aos filtros."}
          </div>
        ) : (
          <div>
            {filtrado.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtrado.length} de {log.length} eventos · últimos 500 carregados
      </p>
    </div>
  );
}
