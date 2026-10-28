import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Eye, Package, ShieldAlert, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { useConfig } from "@/lib/config-store";
import { calcularAlertas, type AlertaAntifurto } from "@/lib/antifurto-store";
import { gravarAudit } from "@/lib/audit-store";

export const Route = createFileRoute("/painel/antifurto")({
  component: Antifurto,
});

const COR_SEV = {
  alto: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  médio: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  baixo: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
} as const;

const LABEL_SEV = { alto: "Alto risco", médio: "Risco médio", baixo: "Baixo risco" } as const;

function RowAlerta({ alerta, expandido, onToggle }: { alerta: AlertaAntifurto; expandido: boolean; onToggle: () => void }) {
  function marcarInvestigado() {
    gravarAudit({
      acao: "ajuste",
      modulo: "Produtos",
      descricao: `Alerta antifurto investigado: "${alerta.produtoNome}" — ${alerta.perdaAcumulada} un. em ${alerta.ocorrencias} ajuste(s).`,
      usuarioNome: "Gerência",
      produtoId: alerta.produtoId,
      produtoNome: alerta.produtoNome,
    });
  }

  return (
    <>
      <tr
        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expandido ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div>
              <p className="font-medium text-sm leading-tight">{alerta.produtoNome}</p>
              <p className="text-xs text-muted-foreground">{alerta.produtoCategoria}</p>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <span className="font-semibold text-rose-600 dark:text-rose-400">{alerta.perdaAcumulada}</span>
          <span className="text-xs text-muted-foreground ml-1">un.</span>
        </td>
        <td className="py-3 px-4 text-center text-sm">{alerta.ocorrencias}</td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {new Date(alerta.ultimaData).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="py-3 px-4">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_SEV[alerta.severidade]}`}>
            {LABEL_SEV[alerta.severidade]}
          </span>
        </td>
        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={marcarInvestigado} className="text-xs h-7">
            <Eye className="h-3 w-3 mr-1" />
            Investigar
          </Button>
        </td>
      </tr>
      {expandido && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-8 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ajustes negativos (últimos 30 dias)</p>
            <div className="space-y-1.5">
              {alerta.movimentos.map((m) => (
                <div key={m.id} className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground w-32 shrink-0">
                    {new Date(m.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })} {new Date(m.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 w-16">{m.qtd} un.</span>
                  <span className="text-muted-foreground">{m.origem || "—"} → {m.destino || "—"}</span>
                  {m.usuario && <span className="text-muted-foreground">· {m.usuario}</span>}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Antifurto() {
  const estoque = useEstoque();
  const produtos = useProdutos();
  const config = useConfig();

  const limiar = config.limiteAntifurtoUnidades ?? 2;
  const alertas = calcularAlertas(estoque.movs, produtos, limiar);

  const [filtroSev, setFiltroSev] = useState<"todos" | "alto" | "médio" | "baixo">("todos");
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtrados = alertas.filter((a) => {
    if (filtroSev !== "todos" && a.severidade !== filtroSev) return false;
    if (busca && !a.produtoNome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const totalPerda = alertas.reduce((s, a) => s + a.perdaAcumulada, 0);
  const qtdAltos = alertas.filter((a) => a.severidade === "alto").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            Alertas Antifurto
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ajustes negativos sem venda registrada nos últimos 30 dias — produtos com perda ≥ {limiar} un. são sinalizados.
          </p>
        </div>
        <Link to="/painel/configuracoes">
          <Button variant="outline" size="sm">Ajustar limiar</Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Produtos sinalizados</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold">{alertas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Unidades perdidas (30 dias)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{totalPerda}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Alertas de alto risco</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className={`text-3xl font-bold ${qtdAltos > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{qtdAltos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9 max-w-56"
        />
        <Select value={filtroSev} onValueChange={(v) => setFiltroSev(v as typeof filtroSev)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as ameaças</SelectItem>
            <SelectItem value="alto">Alto risco</SelectItem>
            <SelectItem value="médio">Risco médio</SelectItem>
            <SelectItem value="baixo">Baixo risco</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          {alertas.length === 0 ? (
            <>
              <ShieldAlert className="h-12 w-12 text-emerald-400/60" />
              <p className="text-lg font-medium">Nenhum alerta encontrado</p>
              <p className="text-sm text-muted-foreground">Não há ajustes negativos acima do limiar ({limiar} un.) nos últimos 30 dias.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">Nenhum alerta corresponde ao filtro.</p>
            </>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Produtos com perda suspeita
            </CardTitle>
            <CardDescription className="text-xs">
              {filtrados.length} de {alertas.length} produto(s) · clique para ver os ajustes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Produto</th>
                    <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Perda (un.)</th>
                    <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Ajustes</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Última ocorrência</th>
                    <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Risco</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((a) => (
                    <RowAlerta
                      key={a.produtoId}
                      alerta={a}
                      expandido={expandido === a.produtoId}
                      onToggle={() => setExpandido(expandido === a.produtoId ? null : a.produtoId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info sobre o limiar */}
      <p className="text-xs text-muted-foreground">
        <Package className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
        Detecta ajustes do tipo <strong>ajuste negativo</strong> nos últimos 30 dias. Limiar atual: <strong>{limiar} unidades</strong>.
        Ajuste o limiar em <Link to="/painel/configuracoes" className="underline text-primary">Configurações</Link>.
      </p>
    </div>
  );
}
