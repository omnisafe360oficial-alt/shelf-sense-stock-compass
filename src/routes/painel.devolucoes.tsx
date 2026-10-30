import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Download, PackageSearch, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDevolicoes, registrarDevolucao, type MotivoDevolucao, type NovaDevolicaoItem } from "@/lib/devolucoes-store";
import { useAuth } from "@/lib/auth";
import { useProdutos } from "@/lib/produtos-store";
import { brl } from "@/lib/mock-data";
import { SkeletonListPage } from "@/components/ui/skeleton-page";

export const Route = createFileRoute("/painel/devolucoes")({
  head: () => ({
    meta: [
      { title: "Devoluções — OmniSafe 360" },
      { name: "description", content: "Registro e histórico de devoluções de produtos." },
      { property: "og:title", content: "Devoluções — OmniSafe 360" },
    ],
  }),
  pendingComponent: SkeletonListPage,
  pendingMs: 200,
  component: Devolucoes,
});

const MOTIVO_LABEL: Record<MotivoDevolucao, string> = {
  avaria: "Avaria",
  vencido: "Vencido",
  excesso: "Excesso de estoque",
  troca: "Troca",
  outros: "Outros",
};

const TIPO_COR = {
  cliente: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  fornecedor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
} as const;

function RowDevolucao({ dev, expandido, onToggle }: { dev: ReturnType<typeof useDevolicoes>[0]; expandido: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors" onClick={onToggle}>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expandido ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="flex items-center gap-2">
              {dev.tipo === "cliente"
                ? <ArrowDownLeft className="h-4 w-4 text-sky-500 shrink-0" />
                : <ArrowUpRight className="h-4 w-4 text-violet-500 shrink-0" />}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COR[dev.tipo]}`}>
                {dev.tipo === "cliente" ? "De cliente" : "Ao fornecedor"}
              </span>
            </div>
          </div>
        </td>
        <td className="py-3 px-4 text-sm text-muted-foreground">
          {new Date(dev.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          {" "}
          <span className="text-xs">{new Date(dev.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </td>
        <td className="py-3 px-4 text-sm">
          <Badge variant="outline" className="text-xs font-normal">{MOTIVO_LABEL[dev.motivo]}</Badge>
        </td>
        <td className="py-3 px-4 text-sm">{dev.fornecedorNome || (dev.tipo === "fornecedor" ? "—" : "")}</td>
        <td className="py-3 px-4 text-sm text-center">{dev.totalItens} un.</td>
        <td className="py-3 px-4 text-sm text-right font-medium">{brl(dev.totalValor)}</td>
      </tr>
      {expandido && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-8 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Itens da devolução</p>
            <div className="space-y-1.5">
              {dev.itens.map((item) => (
                <div key={item.id} className="flex items-center gap-4 text-xs">
                  <span className="font-medium w-48 truncate">{item.produtoNome}</span>
                  <span className="text-muted-foreground">{item.qtd} un.</span>
                  {item.precoUnitario > 0 && <span className="text-muted-foreground">· {brl(item.precoUnitario)}/un.</span>}
                </div>
              ))}
              {dev.observacao && (
                <p className="text-xs text-muted-foreground mt-2 italic">Obs.: {dev.observacao}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const FORM_VAZIO = {
  tipo: "cliente" as "cliente" | "fornecedor",
  motivo: "outros" as MotivoDevolucao,
  fornecedorNome: "",
  observacao: "",
};

function NovaDevolucaoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const produtos = useProdutos();
  const auth = useAuth();
  const [form, setForm] = useState(FORM_VAZIO);
  const [itens, setItens] = useState<NovaDevolicaoItem[]>([]);
  const [buscaProd, setBuscaProd] = useState("");
  const [qtdInput, setQtdInput] = useState("1");
  const [precoInput, setPrecoInput] = useState("");
  const [salvando, setSalvando] = useState(false);

  const produtosFiltrados = buscaProd.length >= 2
    ? produtos.filter((p) =>
        !p.parentId &&
        (p.nome.toLowerCase().includes(buscaProd.toLowerCase()) ||
          p.codigo.toLowerCase().includes(buscaProd.toLowerCase())),
      ).slice(0, 6)
    : [];

  function adicionarItem(p: typeof produtos[0]) {
    const qtd = parseFloat(qtdInput.replace(",", ".")) || 1;
    const preco = parseFloat(precoInput.replace(",", ".")) || 0;
    setItens((prev) => {
      const existente = prev.findIndex((i) => i.produtoId === p.id);
      if (existente >= 0) {
        return prev.map((i, idx) => idx === existente ? { ...i, qtd: i.qtd + qtd } : i);
      }
      return [...prev, { produtoId: p.id, produtoNome: p.nome, qtd, precoUnitario: preco || p.preco }];
    });
    setBuscaProd("");
    setQtdInput("1");
    setPrecoInput("");
  }

  async function salvar() {
    setSalvando(true);
    await registrarDevolucao({
      tipo: form.tipo,
      motivo: form.motivo,
      fornecedorNome: form.fornecedorNome || undefined,
      observacao: form.observacao || undefined,
      usuarioNome: auth.nomeProprietario ?? "Sistema",
      itens,
    });
    setSalvando(false);
    setForm(FORM_VAZIO);
    setItens([]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova devolução</DialogTitle>
          <DialogDescription>Registre uma devolução de cliente ou ao fornecedor. O estoque é atualizado automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as "cliente" | "fornecedor" }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">↙ De cliente</SelectItem>
                  <SelectItem value="fornecedor">↗ Ao fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Motivo</Label>
              <Select value={form.motivo} onValueChange={(v) => setForm((f) => ({ ...f, motivo: v as MotivoDevolucao }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avaria">Avaria</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="excesso">Excesso de estoque</SelectItem>
                  <SelectItem value="troca">Troca</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.tipo === "fornecedor" && (
            <div>
              <Label className="text-xs mb-1.5 block">Fornecedor (opcional)</Label>
              <Input
                placeholder="Nome do fornecedor"
                value={form.fornecedorNome}
                onChange={(e) => setForm((f) => ({ ...f, fornecedorNome: e.target.value }))}
                className="h-9"
              />
            </div>
          )}

          {/* Busca de produto */}
          <div>
            <Label className="text-xs mb-1.5 block">Adicionar produto</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Buscar por nome ou código…"
                  value={buscaProd}
                  onChange={(e) => setBuscaProd(e.target.value)}
                  className="h-9"
                />
                {produtosFiltrados.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {produtosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/60 text-left"
                        onClick={() => adicionarItem(p)}
                      >
                        <span className="font-medium truncate">{p.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.codigo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Qtd"
                value={qtdInput}
                onChange={(e) => setQtdInput(e.target.value)}
                className="h-9 w-20"
              />
              <Input
                placeholder="R$ unit."
                value={precoInput}
                onChange={(e) => setPrecoInput(e.target.value)}
                className="h-9 w-24"
              />
            </div>
          </div>

          {/* Lista de itens */}
          {itens.length > 0 && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Produto</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Qtd</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="py-2 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium truncate max-w-36">{item.produtoNome}</td>
                      <td className="py-2 px-3 text-center">{item.qtd}</td>
                      <td className="py-2 px-3 text-right">{item.precoUnitario > 0 ? brl(item.qtd * item.precoUnitario) : "—"}</td>
                      <td className="py-2 px-2">
                        <button type="button" onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive" aria-label="Remover item">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <Label className="text-xs mb-1.5 block">Observação (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais…"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || itens.length === 0}>
            {salvando ? "Salvando…" : "Registrar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Devolucoes() {
  const devolucoes = useDevolicoes();
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "cliente" | "fornecedor">("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtradas = devolucoes.filter((d) => filtroTipo === "todos" || d.tipo === filtroTipo);

  const totalCliente = devolucoes.filter((d) => d.tipo === "cliente").length;
  const totalFornecedor = devolucoes.filter((d) => d.tipo === "fornecedor").length;
  const valorTotal = devolucoes.reduce((s, d) => s + d.totalValor, 0);

  function exportarCSV() {
    const hoje = new Date().toISOString().slice(0, 10);
    const rows = ["Tipo,Data,Motivo,Fornecedor,Produto,Qtd,Valor unit.,Total"];
    for (const d of devolucoes) {
      const data = new Date(d.data).toLocaleDateString("pt-BR");
      const tipo = d.tipo === "cliente" ? "De cliente" : "Ao fornecedor";
      const fornecedor = d.fornecedorNome || "";
      const motivo = MOTIVO_LABEL[d.motivo];
      for (const item of d.itens) {
        rows.push(`"${tipo}","${data}","${motivo}","${fornecedor}","${item.produtoNome.replace(/"/g, '""')}",${item.qtd},${item.precoUnitario.toFixed(2)},${(item.qtd * item.precoUnitario).toFixed(2)}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devolucoes-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Devoluções</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Devoluções de clientes e ao fornecedor — estoque atualizado automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          {devolucoes.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-4 w-4 mr-1.5" />
              Exportar CSV
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Nova devolução
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <ArrowDownLeft className="h-3.5 w-3.5 text-sky-500" />
              De clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold">{totalCliente}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-violet-500" />
              Ao fornecedor
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-3xl font-bold">{totalFornecedor}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Valor total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <p className="text-2xl font-bold">{brl(valorTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {(["todos", "cliente", "fornecedor"] as const).map((t) => (
          <Button
            key={t}
            variant={filtroTipo === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroTipo(t)}
          >
            {t === "todos" ? "Todas" : t === "cliente" ? "↙ De cliente" : "↗ Ao fornecedor"}
          </Button>
        ))}
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <PackageSearch className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium">Nenhuma devolução registrada</p>
          <p className="text-sm text-muted-foreground">Clique em "Nova devolução" para registrar.</p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova devolução
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico de devoluções</CardTitle>
            <CardDescription className="text-xs">{filtradas.length} registro(s) · clique para expandir itens</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Motivo</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-center py-2.5 px-4 text-xs font-medium text-muted-foreground">Qtd</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d) => (
                    <RowDevolucao
                      key={d.id}
                      dev={d}
                      expandido={expandido === d.id}
                      onToggle={() => setExpandido(expandido === d.id ? null : d.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <NovaDevolucaoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
