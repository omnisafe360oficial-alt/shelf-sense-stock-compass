import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Delete,
  EyeOff,
  Package,
  PackageOpen,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  UNIDADES_CONFIG,
  finalizarRecebimento,
  getRecebeEstado,
  type ItemRecebimento,
  type RecebeUnidade,
} from "@/lib/recebe-store";
import { getProdutos } from "@/lib/produtos-store";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recebe/receber")({
  validateSearch: (s: Record<string, unknown>) => ({
    pedidoId: typeof s.pedidoId === "string" ? s.pedidoId : undefined,
  }) as { pedidoId?: string },
  component: ReceberFluxo,
});

type Etapa = "inicio" | "identificar" | "unidade" | "contagem" | "lote" | "comparativo" | "resumo" | "sucesso";

type ProdutoIdentificado = { id: string; nome: string; codigo: string; categoria: string };

type FluxoState = {
  etapa: Etapa;
  tipo: "pedido" | "avulso" | null;
  fornecedor: string;
  pedidoId?: string;
  pedidoNumero?: string;
  itens: ItemRecebimento[];
  produtoAtual: ProdutoIdentificado | null;
  unidadeAtual: RecebeUnidade;
  fatorAtual: number;
  fatorInput: string;
  qtdInput: string;
  loteAtual: string;
  validadeAtual: string;
  obsAtual: string;
  qtdEsperadaAtual?: number;
  obsGeral: string;
  recebimentoFinalizado?: { totalItens: number; totalDivergencias: number };
};

const ESTADO_INICIAL: FluxoState = {
  etapa: "inicio",
  tipo: null,
  fornecedor: "",
  pedidoId: undefined,
  pedidoNumero: undefined,
  itens: [],
  produtoAtual: null,
  unidadeAtual: "UN",
  fatorAtual: 1,
  fatorInput: "1",
  qtdInput: "",
  loteAtual: "",
  validadeAtual: "",
  obsAtual: "",
  obsGeral: "",
};

function progresso(etapa: Etapa): number {
  const mapa: Record<Etapa, number> = {
    inicio: 10,
    identificar: 25,
    unidade: 45,
    contagem: 60,
    lote: 75,
    comparativo: 80,
    resumo: 90,
    sucesso: 100,
  };
  return mapa[etapa];
}

function diasAteValidade(iso: string) {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// ─── Custom numpad ────────────────────────────────────────────────────────────

function NumPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  function press(k: string) {
    if (k === "⌫") {
      onChange(value.slice(0, -1));
    } else if (k === ".") {
      if (!value.includes(".")) onChange(value + ".");
    } else {
      if (value.length >= 7) return;
      onChange(value + k);
    }
  }

  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            press(k);
          }}
          className={cn(
            "flex h-16 items-center justify-center rounded-xl border border-border bg-card font-display text-xl font-bold text-foreground transition-colors active:bg-muted",
            k === "⌫" && "text-destructive",
          )}
        >
          {k === "⌫" ? <Delete className="h-5 w-5" /> : k}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ReceberFluxo() {
  const { pedidoId: pedidoIdParam } = Route.useSearch();
  const navigate = useNavigate();
  const [s, setS] = useState<FluxoState>(() => {
    if (pedidoIdParam) {
      const estado = getRecebeEstado();
      const pedido = estado.pedidos.find((p) => p.id === pedidoIdParam);
      if (pedido) {
        return {
          ...ESTADO_INICIAL,
          etapa: "identificar",
          tipo: "pedido",
          fornecedor: pedido.fornecedor,
          pedidoId: pedido.id,
          pedidoNumero: pedido.numero,
        };
      }
    }
    return ESTADO_INICIAL;
  });
  const [busca, setBusca] = useState("");
  const [showLista, setShowLista] = useState(false);
  const [scanModal, setScanModal] = useState(false);

  const up = (patch: Partial<FluxoState>) => setS((prev) => ({ ...prev, ...patch }));

  function voltar() {
    const ordem: Etapa[] = ["inicio", "identificar", "unidade", "contagem", "lote", "comparativo", "resumo", "sucesso"];
    const idx = ordem.indexOf(s.etapa);
    if (idx <= 0) {
      navigate({ to: "/recebe" });
      return;
    }
    let etapaAnterior = ordem[idx - 1];
    if (etapaAnterior === "comparativo" && s.tipo !== "pedido") etapaAnterior = "lote";
    up({ etapa: etapaAnterior });
  }

  function selecionarProduto(p: ProdutoIdentificado) {
    const pedido = s.pedidoId ? getRecebeEstado().pedidos.find((x) => x.id === s.pedidoId) : null;
    const itemPedido = pedido?.itens.find((i) => i.produtoId === p.id);
    up({
      produtoAtual: p,
      unidadeAtual: "UN",
      fatorAtual: 1,
      fatorInput: "1",
      qtdInput: "",
      loteAtual: "",
      validadeAtual: "",
      obsAtual: "",
      qtdEsperadaAtual: itemPedido?.qtdSolicitada,
      etapa: "unidade",
    });
    setBusca("");
  }

  function confirmarUnidade() {
    const cfg = UNIDADES_CONFIG.find((u) => u.value === s.unidadeAtual)!;
    const fator = cfg.fatorFixo ?? (Number(s.fatorInput) || 1);
    up({ fatorAtual: fator, etapa: "contagem" });
  }

  function confirmarContagem() {
    const qtd = parseFloat(s.qtdInput) || 0;
    if (qtd <= 0) return;
    up({ etapa: "lote" });
  }

  function adicionarItem() {
    const dias = diasAteValidade(s.validadeAtual);
    if (dias !== null && dias < 0) return; // vencida — bloqueado pelo UI
    const qtd = parseFloat(s.qtdInput) || 0;
    const qtdUN = Math.round(qtd * s.fatorAtual * 100) / 100;
    const item: ItemRecebimento = {
      id: crypto.randomUUID(),
      produtoId: s.produtoAtual!.id,
      produtoNome: s.produtoAtual!.nome,
      produtoCodigo: s.produtoAtual!.codigo,
      unidade: s.unidadeAtual,
      fator: s.fatorAtual,
      qtdContada: qtd,
      qtdUN,
      qtdEsperada: s.qtdEsperadaAtual,
      lote: s.loteAtual,
      validade: s.validadeAtual,
      observacao: s.obsAtual,
    };
    const itens = [...s.itens, item];
    if (s.tipo === "pedido" && s.qtdEsperadaAtual !== undefined) {
      up({ itens, etapa: "comparativo" });
    } else {
      up({
        itens,
        produtoAtual: null,
        qtdInput: "",
        loteAtual: "",
        validadeAtual: "",
        obsAtual: "",
        etapa: "identificar",
      });
    }
  }

  function confirmarRecebimento() {
    const divergencias = s.itens.filter(
      (i) => i.qtdEsperada !== undefined && Math.abs(i.qtdUN - i.qtdEsperada) > 0,
    ).length;
    finalizarRecebimento({
      fornecedor: s.fornecedor,
      pedidoId: s.pedidoId,
      pedidoNumero: s.pedidoNumero,
      operador: "Carlos Mendes",
      itens: s.itens,
      observacaoGeral: s.obsGeral,
      totalDivergencias: divergencias,
    });
    up({
      etapa: "sucesso",
      recebimentoFinalizado: { totalItens: s.itens.length, totalDivergencias: divergencias },
    });
  }

  const buscaFiltrada = busca.length >= 2
    ? getProdutos().filter(
        (p) =>
          p.nome.toLowerCase().includes(busca.toLowerCase()) ||
          p.codigo.includes(busca),
      ).slice(0, 8)
    : [];

  const unidadeCfg = UNIDADES_CONFIG.find((u) => u.value === s.unidadeAtual)!;
  const fatorEfetivo = unidadeCfg.fatorFixo ?? (Number(s.fatorInput) || 1);
  const qtdAtualNum = parseFloat(s.qtdInput) || 0;
  const validadeDias = diasAteValidade(s.validadeAtual);

  // ── Etapa: inicio ──────────────────────────────────────────────────────────

  if (s.etapa === "inicio") {
    const estado = getRecebeEstado();
    const pedidosPendentes = estado.pedidos.filter(
      (p) => p.status === "enviado" || p.status === "confirmado",
    );

    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("inicio")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={() => navigate({ to: "/recebe" })} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Novo recebimento</h1>
        </div>
        <div className="flex-1 space-y-4 px-4 py-5">
          <p className="text-sm text-muted-foreground">Como deseja registrar este recebimento?</p>
          <button
            onClick={() => {
              if (s.tipo === "pedido" && s.pedidoId) {
                up({ etapa: "identificar" });
              } else {
                up({ tipo: s.tipo === "pedido" ? null : "pedido" });
              }
            }}
            className={cn(
              "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors",
              s.tipo === "pedido" ? "border-primary bg-primary/5" : "border-border bg-card",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Vinculado a pedido de compra</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Dá baixa em um pedido já existente</p>
            </div>
          </button>

          {s.tipo === "pedido" && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              {pedidosPendentes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">Nenhum pedido pendente</p>
              ) : (
                pedidosPendentes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      up({
                        tipo: "pedido",
                        fornecedor: p.fornecedor,
                        pedidoId: p.id,
                        pedidoNumero: p.numero,
                        etapa: "identificar",
                      })
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-muted"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-primary">{p.numero}</p>
                      <p className="text-sm text-foreground">{p.fornecedor}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => up({ tipo: s.tipo === "avulso" ? null : "avulso" })}
            className={cn(
              "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors",
              s.tipo === "avulso" ? "border-primary bg-primary/5" : "border-border bg-card",
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <PackageOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Recebimento avulso</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Sem pedido associado — entrada livre</p>
            </div>
          </button>

          {s.tipo === "avulso" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fornecedor (opcional)</label>
              <input
                type="text"
                placeholder="Nome do fornecedor..."
                value={s.fornecedor}
                onChange={(e) => up({ fornecedor: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-4">
          <button
            disabled={!s.tipo || (s.tipo === "pedido" && !s.pedidoId)}
            onClick={() => s.tipo === "avulso" && up({ etapa: "identificar" })}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            Continuar →
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: identificar ────────────────────────────────────────────────────

  if (s.etapa === "identificar") {
    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("identificar")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-base font-semibold text-foreground">Adicionar produto</h1>
            <p className="text-xs text-muted-foreground">{s.fornecedor || "Avulso"}</p>
          </div>
          {s.itens.length > 0 && (
            <button
              onClick={() => setShowLista(true)}
              className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
            >
              {s.itens.length} item{s.itens.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 px-4 py-5">
          {/* Scan button */}
          <button
            onClick={() => setScanModal(true)}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-6 transition-colors active:bg-primary/10"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
              }}
            >
              <ScanBarcode className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <p className="font-display text-sm font-semibold text-foreground">Escanear código de barras</p>
              <p className="text-xs text-muted-foreground">Câmera ou leitor físico</p>
            </div>
          </button>

          {/* Busca por nome */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {buscaFiltrada.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              {buscaFiltrada.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() =>
                    selecionarProduto({
                      id: p.id,
                      nome: p.nome,
                      codigo: p.codigo,
                      categoria: p.categoria,
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted",
                    i < buscaFiltrada.length - 1 && "border-b border-border",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.codigo} · {p.categoria}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() =>
              selecionarProduto({
                id: crypto.randomUUID(),
                nome: busca || "Produto avulso",
                codigo: "—",
                categoria: "Avulso",
              })
            }
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            + Produto não cadastrado (digitar nome livre)
          </button>
        </div>

        {s.itens.length > 0 && (
          <div className="border-t border-border px-4 py-4">
            <button
              onClick={() => up({ etapa: "resumo" })}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
              }}
            >
              Finalizar recebimento ({s.itens.length} produto{s.itens.length !== 1 ? "s" : ""}) →
            </button>
          </div>
        )}

        {/* Modal scan */}
        {scanModal && (
          <div className="fixed inset-0 z-50">
            <BarcodeScanner
              titulo="Escanear produto"
              onClose={() => setScanModal(false)}
              onScan={(codigo) => {
                const produto = getProdutos().find((p) => p.codigo === codigo.trim());
                if (produto) {
                  setScanModal(false);
                  selecionarProduto({ id: produto.id, nome: produto.nome, codigo: produto.codigo, categoria: produto.categoria });
                }
              }}
            />
          </div>
        )}

        {/* Sheet lista de itens */}
        {showLista && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/50" onClick={() => setShowLista(false)}>
            <div
              className="mt-auto max-h-[70vh] overflow-y-auto rounded-t-2xl bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4">
                <p className="font-display text-base font-semibold text-foreground">
                  Itens adicionados ({s.itens.length})
                </p>
                <button onClick={() => setShowLista(false)} className="text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="divide-y divide-border px-4 pb-4">
                {s.itens.map((item) => {
                  const temDiv =
                    item.qtdEsperada !== undefined && Math.abs(item.qtdUN - item.qtdEsperada) > 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      <div
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          temDiv ? "bg-destructive" : "bg-success",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.produtoNome}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.qtdContada} {item.unidade}
                          {item.fator !== 1 && ` = ${item.qtdUN} UN`}
                          {item.lote && ` · Lote ${item.lote}`}
                        </p>
                      </div>
                      <button
                        onClick={() => up({ itens: s.itens.filter((i) => i.id !== item.id) })}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Etapa: unidade ────────────────────────────────────────────────────────

  if (s.etapa === "unidade") {
    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("unidade")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Unidade de entrada</h1>
        </div>

        <div className="flex-1 space-y-4 px-4 py-5">
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Package className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">{s.produtoAtual?.nome}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Como chegou a mercadoria?</p>
            <div className="grid grid-cols-4 gap-2">
              {UNIDADES_CONFIG.map((u) => (
                <button
                  key={u.value}
                  onClick={() => up({ unidadeAtual: u.value, fatorInput: u.fatorFixo ? String(u.fatorFixo) : "" })}
                  className={cn(
                    "rounded-xl border py-3 text-sm font-semibold transition-colors",
                    s.unidadeAtual === u.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {unidadeCfg.precisaFator && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Quantas UN por {unidadeCfg.nomeCompleto}?
              </label>
              <input
                type="number"
                min={1}
                placeholder="Ex: 24"
                value={s.fatorInput}
                onChange={(e) => up({ fatorInput: e.target.value })}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          )}

          {(unidadeCfg.fatorFixo || Number(s.fatorInput) > 0) && (
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3">
              <p className="text-sm text-foreground">
                1 {unidadeCfg.nomeCompleto} ={" "}
                <strong>{unidadeCfg.fatorFixo ?? s.fatorInput} UN</strong>
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-4">
          <button
            onClick={confirmarUnidade}
            disabled={unidadeCfg.precisaFator && !Number(s.fatorInput)}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            Continuar →
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: contagem ───────────────────────────────────────────────────────

  if (s.etapa === "contagem") {
    return (
      <div className="flex min-h-full flex-col bg-card">
        <BarraProgresso pct={progresso("contagem")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Contagem cega</h1>
        </div>

        <div className="flex flex-1 flex-col items-center justify-start px-4 py-6">
          <EyeOff className="h-6 w-6 text-muted-foreground" />
          <p className="mt-1 text-center text-xs text-muted-foreground">Conte fisicamente sem ver a quantidade esperada</p>
          <p className="mt-3 font-display text-sm font-semibold text-foreground">{s.produtoAtual?.nome}</p>

          <div className="mt-8 w-full text-center">
            <p className="font-display text-7xl font-bold text-foreground">
              {s.qtdInput || "0"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {UNIDADES_CONFIG.find((u) => u.value === s.unidadeAtual)?.nomeCompleto ?? s.unidadeAtual}
              {s.fatorAtual > 1 && qtdAtualNum > 0 && (
                <> = {Math.round(qtdAtualNum * s.fatorAtual * 100) / 100} UN</>
              )}
            </p>
          </div>

          <div className="mt-8 w-full">
            <NumPad value={s.qtdInput} onChange={(v) => up({ qtdInput: v })} />
          </div>
        </div>

        <div className="border-t border-border px-4 py-4">
          <button
            onClick={confirmarContagem}
            disabled={qtdAtualNum <= 0}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            Confirmar contagem
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: lote ───────────────────────────────────────────────────────────

  if (s.etapa === "lote") {
    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("lote")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Dados do lote</h1>
        </div>

        <div className="flex-1 space-y-4 px-4 py-5">
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Package className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{s.produtoAtual?.nome}</p>
              <p className="text-xs text-muted-foreground">
                {s.qtdInput} {s.unidadeAtual}
                {s.fatorAtual > 1 && ` = ${Math.round(qtdAtualNum * s.fatorAtual * 100) / 100} UN`}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Número do lote</label>
            <input
              type="text"
              placeholder="Ex: L2410001"
              value={s.loteAtual}
              onChange={(e) => up({ loteAtual: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data de validade</label>
            <input
              type="date"
              value={s.validadeAtual}
              onChange={(e) => up({ validadeAtual: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
            {validadeDias !== null && (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium",
                  validadeDias < 0
                    ? "bg-destructive/10 text-destructive"
                    : validadeDias <= 15
                      ? "bg-warning/10 text-warning"
                      : "bg-success/10 text-success",
                )}
              >
                {validadeDias < 0
                  ? "⛔ Mercadoria vencida — não registrar"
                  : validadeDias <= 15
                    ? `⚠️ Atenção: vence em ${validadeDias} dias`
                    : `✓ Validade OK — ${validadeDias} dias restantes`}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Observação (opcional)</label>
            <textarea
              placeholder="Ex: caixa amassada, etiqueta ilegível..."
              value={s.obsAtual}
              onChange={(e) => up({ obsAtual: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="border-t border-border px-4 py-4">
          <button
            onClick={adicionarItem}
            disabled={validadeDias !== null && validadeDias < 0}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.15 165), oklch(0.65 0.15 165))" }}
          >
            <span className="flex items-center justify-center gap-2">
              <Check className="h-4 w-4" /> Adicionar à lista
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: comparativo ────────────────────────────────────────────────────

  if (s.etapa === "comparativo") {
    const ultimoItem = s.itens[s.itens.length - 1];
    const esperado = ultimoItem?.qtdEsperada;
    const contado = ultimoItem?.qtdUN ?? 0;
    const diff = esperado !== undefined ? contado - esperado : 0;
    const temDiv = esperado !== undefined && diff !== 0;

    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("comparativo")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Resultado da contagem</h1>
        </div>

        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Package className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">{ultimoItem?.produtoNome}</p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-4 space-y-3",
              temDiv ? "border-destructive/20 bg-destructive/5" : "border-success/20 bg-success/5",
            )}
          >
            {esperado !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">📦 Esperado</span>
                <span className="font-display text-sm font-semibold text-muted-foreground">
                  {esperado} UN
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">✅ Contado</span>
              <span className="font-display text-sm font-bold text-foreground">{contado} UN</span>
            </div>
            {esperado !== undefined && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2",
                  temDiv ? "bg-destructive/10" : "bg-success/10",
                )}
              >
                <span className={cn("text-sm font-semibold", temDiv ? "text-destructive" : "text-success")}>
                  {temDiv
                    ? `Divergência de ${diff > 0 ? "+" : ""}${diff} UN`
                    : "Confere ✓"}
                </span>
                {temDiv && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 space-y-2">
          <button
            onClick={() =>
              up({
                produtoAtual: null,
                qtdInput: "",
                loteAtual: "",
                validadeAtual: "",
                obsAtual: "",
                etapa: "identificar",
              })
            }
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            Próximo produto →
          </button>
          <button
            onClick={voltar}
            className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          >
            Ajustar quantidade
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: resumo ─────────────────────────────────────────────────────────

  if (s.etapa === "resumo") {
    const divergencias = s.itens.filter(
      (i) => i.qtdEsperada !== undefined && Math.abs(i.qtdUN - i.qtdEsperada) > 0,
    );

    return (
      <div className="flex min-h-full flex-col">
        <BarraProgresso pct={progresso("resumo")} />
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={voltar} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-foreground">Resumo do recebimento</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {/* Cabeçalho */}
          <div
            className="rounded-xl p-4 text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            <p className="font-display text-sm font-semibold">{s.fornecedor || "Avulso"}</p>
            {s.pedidoNumero && <p className="mt-0.5 font-mono text-xs opacity-80">{s.pedidoNumero}</p>}
            <p className="mt-1 text-xs opacity-70">
              Carlos Mendes ·{" "}
              {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          {/* Lista de itens */}
          <div className="space-y-2">
            {s.itens.map((item) => {
              const temDiv = item.qtdEsperada !== undefined && Math.abs(item.qtdUN - item.qtdEsperada) > 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-3",
                    temDiv ? "border-destructive/20 bg-destructive/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", temDiv ? "bg-destructive" : "bg-success")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.produtoNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.qtdContada} {item.unidade}
                        {item.fator !== 1 && ` = ${item.qtdUN} UN`}
                        {item.lote && ` · Lote ${item.lote}`}
                        {item.validade && ` · Val. ${new Date(item.validade + "T12:00:00").toLocaleDateString("pt-BR")}`}
                      </p>
                      {temDiv && item.qtdEsperada !== undefined && (
                        <p className="text-xs text-destructive">
                          Esperado: {item.qtdEsperada} UN · Diferença: {item.qtdUN - item.qtdEsperada > 0 ? "+" : ""}{item.qtdUN - item.qtdEsperada}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de produtos</span>
              <span className="font-semibold text-foreground">{s.itens.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de unidades</span>
              <span className="font-semibold text-foreground">
                {s.itens.reduce((t, i) => t + i.qtdUN, 0)} UN
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Divergências</span>
              <span className={cn("font-semibold", divergencias.length > 0 ? "text-destructive" : "text-success")}>
                {divergencias.length > 0 ? `${divergencias.length} item(s)` : "Nenhuma ✓"}
              </span>
            </div>
          </div>

          {/* Observação geral */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Observação geral (opcional)</label>
            <textarea
              placeholder="Observações sobre este recebimento..."
              value={s.obsGeral}
              onChange={(e) => up({ obsGeral: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 space-y-2">
          <button
            onClick={confirmarRecebimento}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Check className="h-4 w-4" /> Confirmar recebimento
            </span>
          </button>
          <button
            onClick={() => up({ etapa: "identificar" })}
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-foreground"
          >
            Adicionar mais produtos
          </button>
        </div>
      </div>
    );
  }

  // ── Etapa: sucesso ────────────────────────────────────────────────────────

  if (s.etapa === "sucesso") {
    const fin = s.recebimentoFinalizado;
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(135deg, oklch(0.55 0.15 165), oklch(0.65 0.15 165))" }}
        >
          <Check className="h-12 w-12 text-white" strokeWidth={3} />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Recebimento finalizado!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fin?.totalItens} produto{fin?.totalItens !== 1 ? "s" : ""} recebido{fin?.totalItens !== 1 ? "s" : ""} ·{" "}
          {fin?.totalDivergencias === 0
            ? "sem divergências"
            : `${fin?.totalDivergencias} divergência(s)`}
        </p>
        <div className="mt-10 w-full space-y-3">
          <button
            onClick={() => { setS(ESTADO_INICIAL); }}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))",
            }}
          >
            Novo recebimento
          </button>
          <button
            onClick={() => navigate({ to: "/recebe/historico" })}
            className="w-full rounded-xl border border-border py-3.5 text-sm font-medium text-foreground"
          >
            Ver histórico
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function BarraProgresso({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full bg-border">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
