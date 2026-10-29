import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpDown, Brain, ChevronDown, ChevronUp, Download, Package, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstoque } from "@/lib/estoque-store";
import { useProdutos } from "@/lib/produtos-store";
import { inteligenciaProdutos, depositoMap, HOJE, type IntelProduto } from "@/lib/computed";
import { cn } from "@/lib/utils";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/inteligencia")({
  head: () => ({
    meta: [{ title: "Inteligência de Estoque — OmniSafe 360" }],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Inteligencia,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = "critico" | "atencao" | "ok";
type Aba = "matriz" | "previsao";
type SortCol = "nome" | "abc" | "xyz" | "velocidade" | "estoqueAtual" | "diasEstoque" | "pontoPedido" | "status";

type IntelRow = {
  produtoId: string;
  produtoNome: string;
  produtoCategoria: string;
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
  velocidade: number;
  desvio: number;
  estoqueAtual: number;
  estoqueSeguranca: number;
  pontoPedido: number;
  diasEstoque: number;
  status: Status;
};

const ABC_CLS: Record<"A" | "B" | "C", string> = {
  A: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  C: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const XYZ_CLS: Record<"X" | "Y" | "Z", string> = {
  X: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Y: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Z: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const STATUS_CLS: Record<Status, string> = {
  critico: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  atencao: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const STATUS_LABEL: Record<Status, string> = { critico: "Crítico", atencao: "Atenção", ok: "OK" };
const SEV_ORDER: Record<Status, number> = { critico: 0, atencao: 1, ok: 2 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcularStatus(estoqueAtual: number, pontoPedido: number, diasEstoque: number, abc: string, xyz: string): Status {
  if (estoqueAtual === 0 || estoqueAtual <= pontoPedido) return "critico";
  if (diasEstoque < 14 || (abc === "A" && xyz === "Z" && diasEstoque < 30)) return "atencao";
  return "ok";
}

function CoberturaBar({ dias, pontoPedido, estoqueAtual }: { dias: number; pontoPedido: number; estoqueAtual: number }) {
  const isCritico = estoqueAtual === 0 || estoqueAtual <= pontoPedido;
  const isAtencao = dias < 14;
  const color = isCritico ? "bg-rose-500" : isAtencao ? "bg-amber-500" : "bg-emerald-500";
  const pct = Math.min(100, Math.max(2, (dias / 30) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums", isCritico ? "text-rose-600 font-bold" : isAtencao ? "text-amber-600" : "text-muted-foreground")}>
        {dias}d
      </span>
    </div>
  );
}

function SortIcon({ col, current, dir }: { col: SortCol; current: SortCol; dir: "asc" | "desc" }) {
  if (col !== current) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30 inline" />;
  return dir === "asc"
    ? <ChevronUp className="ml-1 h-3 w-3 inline" />
    : <ChevronDown className="ml-1 h-3 w-3 inline" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

function Inteligencia() {
  const estoque = useEstoque();
  const produtos = useProdutos();

  const intel = useMemo(
    () => inteligenciaProdutos(estoque.movs, estoque.gondola, estoque.lotes),
    [estoque.movs, estoque.gondola, estoque.lotes],
  );

  const dep = useMemo(() => depositoMap(estoque.lotes), [estoque.lotes]);

  const rows = useMemo<IntelRow[]>(() => {
    return produtos
      .map((p) => {
        const info: IntelProduto | undefined = intel[p.id];
        if (!info) return null;
        const estoqueAtual = (estoque.gondola[p.id] ?? 0) + (dep[p.id] ?? 0);
        return {
          produtoId: p.id,
          produtoNome: p.nome,
          produtoCategoria: p.categoria,
          abc: info.abc,
          xyz: info.xyz,
          velocidade: info.velocidadeDiaria,
          desvio: info.desvio,
          estoqueAtual,
          estoqueSeguranca: info.estoqueSeguranca,
          pontoPedido: info.pontoPedido,
          diasEstoque: info.diasEstoque,
          status: calcularStatus(estoqueAtual, info.pontoPedido, info.diasEstoque, info.abc, info.xyz),
        };
      })
      .filter((r): r is IntelRow => r !== null);
  }, [produtos, intel, estoque.gondola, dep]);

  const [aba, setAba] = useState<Aba>("matriz");
  const [busca, setBusca] = useState("");
  const [filtroAbc, setFiltroAbc] = useState<"Todos" | "A" | "B" | "C">("Todos");
  const [filtroXyz, setFiltroXyz] = useState<"Todos" | "X" | "Y" | "Z">("Todos");
  const [filtroStatus, setFiltroStatus] = useState<"Todos" | "critico" | "atencao" | "ok">("Todos");
  const [sortCol, setSortCol] = useState<SortCol>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtradas = useMemo(() => {
    let r = rows;
    if (busca) r = r.filter((x) => x.produtoNome.toLowerCase().includes(busca.toLowerCase()) || x.produtoCategoria.toLowerCase().includes(busca.toLowerCase()));
    if (filtroAbc !== "Todos") r = r.filter((x) => x.abc === filtroAbc);
    if (filtroXyz !== "Todos") r = r.filter((x) => x.xyz === filtroXyz);
    if (filtroStatus !== "Todos") r = r.filter((x) => x.status === filtroStatus);
    return [...r].sort((a, b) => {
      let v = 0;
      switch (sortCol) {
        case "nome": v = a.produtoNome.localeCompare(b.produtoNome, "pt-BR"); break;
        case "abc": v = a.abc.localeCompare(b.abc); break;
        case "xyz": v = a.xyz.localeCompare(b.xyz); break;
        case "velocidade": v = a.velocidade - b.velocidade; break;
        case "estoqueAtual": v = a.estoqueAtual - b.estoqueAtual; break;
        case "diasEstoque": v = a.diasEstoque - b.diasEstoque; break;
        case "pontoPedido": v = a.pontoPedido - b.pontoPedido; break;
        case "status": v = SEV_ORDER[a.status] - SEV_ORDER[b.status] || a.diasEstoque - b.diasEstoque; break;
      }
      return sortDir === "asc" ? v : -v;
    });
  }, [rows, busca, filtroAbc, filtroXyz, filtroStatus, sortCol, sortDir]);

  // KPIs
  const qtdCritico = rows.filter((r) => r.status === "critico").length;
  const qtdAtencao = rows.filter((r) => r.status === "atencao").length;
  const mediaCobertura = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.diasEstoque, 0) / rows.length) : 0;
  const qtdA = rows.filter((r) => r.abc === "A").length;
  const qtdB = rows.filter((r) => r.abc === "B").length;
  const qtdC = rows.filter((r) => r.abc === "C").length;

  // Previsão groups
  const previsao = useMemo(() => {
    const sorted = [...rows].filter((r) => r.velocidade > 0).sort((a, b) => a.diasEstoque - b.diasEstoque);
    return {
      agora: sorted.filter((r) => r.status === "critico"),
      semana: sorted.filter((r) => r.status !== "critico" && r.diasEstoque <= 7),
      proxima: sorted.filter((r) => r.diasEstoque > 7 && r.diasEstoque <= 14),
      trinta: sorted.filter((r) => r.diasEstoque > 14 && r.diasEstoque <= 30),
      ok: sorted.filter((r) => r.diasEstoque > 30),
    };
  }, [rows]);

  function exportarCSV() {
    const cab = ["Produto", "Categoria", "ABC", "XYZ", "Velocidade (un/dia)", "σ", "Estoque atual", "Estoque segurança", "Ponto de Pedido", "Cobertura (dias)", "Status"];
    const linhas = filtradas.map((r) => [
      r.produtoNome, r.produtoCategoria, r.abc, r.xyz,
      r.velocidade.toFixed(2), r.desvio.toFixed(2),
      String(r.estoqueAtual), String(r.estoqueSeguranca), String(r.pontoPedido),
      String(r.diasEstoque), STATUS_LABEL[r.status],
    ]);
    const csv = [cab, ...linhas].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inteligencia-estoque-${HOJE}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Inner component for forecast section
  function PrevisaoSection({ titulo, itens, corCls }: { titulo: string; itens: IntelRow[]; corCls: string }) {
    if (itens.length === 0) return null;
    return (
      <div>
        <h3 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", corCls)}>
          {titulo}
          <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs font-bold">{itens.length}</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((r) => (
            <Link
              key={r.produtoId}
              to="/painel/produtos/$id"
              params={{ id: r.produtoId }}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:bg-muted/50 transition"
            >
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", ABC_CLS[r.abc])}>
                {r.abc}{r.xyz}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.produtoNome}</p>
                <p className="text-xs text-muted-foreground">
                  {r.velocidade.toFixed(1)} un/dia · {r.estoqueAtual} un em estoque
                </p>
              </div>
              <span className={cn("text-xs font-semibold shrink-0 tabular-nums", STATUS_CLS[r.status].replace("bg-", "text-").replace(/\s.*/g, ""))}>
                {r.diasEstoque}d
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Inteligência de Estoque
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rows.length} produto{rows.length !== 1 ? "s" : ""} com dados de IA · Motor baseado nos últimos 60 dias
          </p>
        </div>
        <Link to="/painel/pedidos/sugerir">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Sugerir Pedido
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Críticos</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className={cn("text-3xl font-bold", qtdCritico > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
              {qtdCritico}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">precisam de pedido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Em atenção</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className={cn("text-3xl font-bold", qtdAtencao > 0 ? "text-amber-600" : "text-muted-foreground")}>
              {qtdAtencao}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Cobertura média</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold">{mediaCobertura}d</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Classe A / B / C</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-xl font-bold">
              <span className="text-rose-600">{qtdA}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-amber-600">{qtdB}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-muted-foreground">{qtdC}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Com dados IA</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <div className="flex border-b">
        <button
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", aba === "matriz" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setAba("matriz")}
        >
          Matriz de Produtos
        </button>
        <button
          className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5", aba === "previsao" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          onClick={() => setAba("previsao")}
        >
          Previsão 30 dias
          {qtdCritico > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 inline-block ml-1" />}
        </button>
      </div>

      {/* ── Tab: Matriz ──────────────────────────────────────────────────────────── */}
      {aba === "matriz" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar produto ou categoria…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 max-w-56"
            />
            <Select value={filtroAbc} onValueChange={(v) => setFiltroAbc(v as typeof filtroAbc)}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">ABC: Todos</SelectItem>
                <SelectItem value="A">Classe A</SelectItem>
                <SelectItem value="B">Classe B</SelectItem>
                <SelectItem value="C">Classe C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroXyz} onValueChange={(v) => setFiltroXyz(v as typeof filtroXyz)}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">XYZ: Todos</SelectItem>
                <SelectItem value="X">Classe X</SelectItem>
                <SelectItem value="Y">Classe Y</SelectItem>
                <SelectItem value="Z">Classe Z</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Status: Todos</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportarCSV} className="h-9 gap-1.5 ml-auto">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Matriz de Inteligência
              </CardTitle>
              <CardDescription className="text-xs">
                {filtradas.length} de {rows.length} produto{rows.length !== 1 ? "s" : ""} · clique no cabeçalho para ordenar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <div className="py-16 text-center">
                  <Brain className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum produto com dados de inteligência ainda.</p>
                  <p className="text-xs text-muted-foreground mt-1">Registre vendas para o motor de IA calcular velocidades.</p>
                </div>
              ) : filtradas.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum produto corresponde ao filtro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("nome")}>
                          Produto <SortIcon col="nome" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("abc")}>
                          Classe <SortIcon col="abc" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("velocidade")}>
                          Velocidade <SortIcon col="velocidade" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("estoqueAtual")}>
                          Estoque <SortIcon col="estoqueAtual" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("diasEstoque")}>
                          Cobertura <SortIcon col="diasEstoque" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-center py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("pontoPedido")}>
                          P. Pedido <SortIcon col="pontoPedido" current={sortCol} dir={sortDir} />
                        </th>
                        <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("status")}>
                          Status <SortIcon col="status" current={sortCol} dir={sortDir} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((r) => (
                        <tr key={r.produtoId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              to="/painel/produtos/$id"
                              params={{ id: r.produtoId }}
                              className="font-medium hover:text-primary hover:underline text-sm"
                            >
                              {r.produtoNome}
                            </Link>
                            <p className="text-xs text-muted-foreground">{r.produtoCategoria}</p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", ABC_CLS[r.abc])}>{r.abc}</span>
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", XYZ_CLS[r.xyz])}>{r.xyz}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <p className="text-sm font-semibold tabular-nums">{r.velocidade.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">±{r.desvio.toFixed(1)} un/dia</p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <p className="text-sm font-semibold tabular-nums">{r.estoqueAtual}</p>
                            <p className="text-xs text-muted-foreground">ES: {r.estoqueSeguranca}</p>
                          </td>
                          <td className="py-3 px-3">
                            <CoberturaBar dias={r.diasEstoque} pontoPedido={r.pontoPedido} estoqueAtual={r.estoqueAtual} />
                          </td>
                          <td className="py-3 px-3 text-center text-sm tabular-nums">{r.pontoPedido}</td>
                          <td className="py-3 px-3">
                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CLS[r.status])}>
                              {STATUS_LABEL[r.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* ── Tab: Previsão ────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {rows.filter((r) => r.velocidade > 0).length === 0 ? (
            <div className="py-16 text-center">
              <Brain className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum produto com velocidade de venda para projetar.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Projeção baseada na velocidade histórica. A cobertura diminui a cada dia de venda — planeje os pedidos com antecedência igual ao lead time.
              </p>
              <PrevisaoSection titulo="⚠️ Pedir agora — estoque no ou abaixo do ponto de pedido" itens={previsao.agora} corCls="text-rose-600 dark:text-rose-400" />
              <PrevisaoSection titulo="Esta semana — cobertura ≤ 7 dias" itens={previsao.semana} corCls="text-amber-600" />
              <PrevisaoSection titulo="Próxima semana — 8 a 14 dias" itens={previsao.proxima} corCls="text-amber-500" />
              <PrevisaoSection titulo="Em 15–30 dias" itens={previsao.trinta} corCls="text-blue-500" />
              {previsao.ok.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                    ✓ Estoque adequado — mais de 30 dias
                    <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs font-bold">{previsao.ok.length}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {previsao.ok.slice(0, 5).map((r) => r.produtoNome).join(", ")}{previsao.ok.length > 5 ? ` e mais ${previsao.ok.length - 5} produto${previsao.ok.length - 5 !== 1 ? "s" : ""}` : ""}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
