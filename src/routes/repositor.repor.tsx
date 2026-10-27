import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, MapPin, Package, ScanLine, Warehouse, ZoomIn } from "lucide-react";
import {
  buscarPorCodigo,
  buscarPorId,
  getRepositorEstado,
  registrarReposicao,
} from "@/lib/repositor-store";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repositor/repor")({
  validateSearch: (s: Record<string, unknown>) => ({ tarefaId: typeof s.tarefaId === "string" ? s.tarefaId : undefined } as { tarefaId?: string }),
  component: RepositorRepor,
});

type Etapa =
  | "inicio"
  | "deposito"
  | "scan"
  | "gondola_loc"
  | "contagem"
  | "resultado"
  | "repor_qtd"
  | "sucesso";

type Produto = { id: string; nome: string; codigo: string; categoria: string; deposito: number; gondola: number; minimo: number; localDeposito?: import("@/lib/mock-data").LocalDeposito; localGondola?: import("@/lib/mock-data").LocalGondola };

type FluxoState = {
  etapa: Etapa;
  produto: Produto | null;
  contagemInput: string;
  qtdContada: number | null;
  reporInput: string;
  scanInput: string;
  scanModal: boolean;
  resultado: { bateu: boolean; diferenca: number; sistema: number } | null;
};

function NumPad({ value, onChange, max }: { value: string; onChange: (v: string) => void; max?: number }) {
  function press(k: string) {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (k === "00") {
      const n = value + "00";
      if (max !== undefined && Number(n) > max) return;
      onChange(n);
      return;
    }
    const n = value + k;
    if (max !== undefined && Number(n) > max) return;
    if (n.length > 5) return;
    onChange(n);
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1","2","3","4","5","6","7","8","9","00","0","⌫"].map((k) => (
        <button
          key={k}
          onPointerDown={(e) => { e.preventDefault(); press(k); }}
          className={cn(
            "flex h-14 items-center justify-center rounded-xl text-xl font-semibold transition-colors active:scale-95",
            k === "⌫" ? "bg-muted/80 text-muted-foreground" : "bg-muted text-foreground",
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function BarraEtapas({ etapa, temTarefa }: { etapa: Etapa; temTarefa: boolean }) {
  const ordem: Etapa[] = temTarefa
    ? ["inicio", "deposito", "scan", "gondola_loc", "contagem", "resultado", "repor_qtd", "sucesso"]
    : ["scan", "gondola_loc", "contagem", "resultado", "repor_qtd", "sucesso"];
  const idx = ordem.indexOf(etapa);
  const total = ordem.length;
  return (
    <div className="flex gap-1 px-4 py-2">
      {ordem.map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-all duration-300",
            i <= idx ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function LocalCard({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: { label: string; val: string | number }[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className={cn("grid gap-2 text-center", items.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-muted p-3">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className="font-display text-xl font-bold text-foreground">{item.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepositorRepor() {
  const { tarefaId } = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();

  const tarefa = tarefaId ? getRepositorEstado().tarefas.find((t) => t.id === tarefaId) : null;
  const produtoInicial: Produto | null = tarefa
    ? (() => {
        const p = buscarPorId(tarefa.produtoId);
        return p
          ? { id: p.id, nome: p.nome, codigo: p.codigo, categoria: p.categoria, deposito: p.deposito, gondola: p.gondola, minimo: p.minimo, localDeposito: p.localDeposito, localGondola: p.localGondola }
          : { id: tarefa.produtoId, nome: tarefa.produtoNome, codigo: tarefa.produtoCodigo, categoria: tarefa.categoria, deposito: tarefa.qtdDeposito, gondola: tarefa.qtdGondola, minimo: tarefa.qtdMinima };
      })()
    : null;

  const etapaInicial: Etapa = tarefa ? "inicio" : "scan";

  const [s, setS] = useState<FluxoState>({
    etapa: etapaInicial,
    produto: produtoInicial,
    contagemInput: "",
    qtdContada: null,
    reporInput: "",
    scanInput: "",
    scanModal: false,
    resultado: null,
  });

  function up(patch: Partial<FluxoState>) {
    setS((prev) => ({ ...prev, ...patch }));
  }

  function voltar() {
    const ordemTarefa: Etapa[] = ["inicio", "deposito", "scan", "gondola_loc", "contagem", "resultado", "repor_qtd", "sucesso"];
    const ordemAvulso: Etapa[] = ["scan", "gondola_loc", "contagem", "resultado", "repor_qtd", "sucesso"];
    const ordem = tarefa ? ordemTarefa : ordemAvulso;
    const idx = ordem.indexOf(s.etapa);
    if (idx <= 0) { navigate({ to: "/repositor" }); return; }
    up({ etapa: ordem[idx - 1] });
  }

  function confirmarScan() {
    const produto = buscarPorCodigo(s.scanInput);
    if (!produto) return;
    const p: Produto = { id: produto.id, nome: produto.nome, codigo: produto.codigo, categoria: produto.categoria, deposito: produto.deposito, gondola: produto.gondola, minimo: produto.minimo, localDeposito: produto.localDeposito, localGondola: produto.localGondola };
    up({ produto: p, scanModal: false, scanInput: "", etapa: "gondola_loc" });
  }

  function confirmarContagem() {
    const qtd = parseInt(s.contagemInput, 10);
    if (isNaN(qtd) || qtd < 0 || s.contagemInput === "") return;
    const sistema = s.produto?.gondola ?? 0;
    const diferenca = qtd - sistema;
    const bateu = diferenca === 0;
    up({ qtdContada: qtd, resultado: { bateu, diferenca, sistema }, etapa: "resultado" });
  }

  function confirmarRepor() {
    const qtd = parseInt(s.reporInput, 10);
    if (!s.produto || isNaN(qtd) || qtd < 0 || s.reporInput === "") return;
    const maxRepor = s.produto.deposito;
    if (qtd > maxRepor) return;

    registrarReposicao({
      produtoId: s.produto.id,
      produtoNome: s.produto.nome,
      produtoCodigo: s.produto.codigo,
      operador: auth.nomeProprietario ?? "Repositor",
      tarefaId: tarefaId,
      qtdSistema: s.resultado?.sistema ?? s.produto.gondola,
      qtdContada: s.qtdContada ?? 0,
      qtdReposta: qtd,
      bateu: s.resultado?.bateu ?? true,
      diferenca: s.resultado?.diferenca ?? 0,
    });
    up({ etapa: "sucesso" });
  }

  const locDep = s.produto?.localDeposito ?? null;
  const locGon = s.produto?.localGondola ?? null;

  // ── SCAN MODAL ──────────────────────────────────────────────────────────────
  if (s.scanModal) {
    return (
      <BarcodeScanner
        titulo="Escanear produto"
        onClose={() => up({ scanModal: false, scanInput: "" })}
        onScan={(codigo) => {
          const produto = buscarPorCodigo(codigo);
          if (produto) {
            const p: Produto = {
              id: produto.id,
              nome: produto.nome,
              codigo: produto.codigo,
              categoria: produto.categoria,
              deposito: produto.deposito,
              gondola: produto.gondola,
              minimo: produto.minimo,
              localDeposito: produto.localDeposito,
              localGondola: produto.localGondola,
            };
            up({ produto: p, scanModal: false, scanInput: "", etapa: "gondola_loc" });
          } else {
            up({ scanInput: codigo });
          }
        }}
      />
    );
  }

  // ── ETAPAS ──────────────────────────────────────────────────────────────────

  const header = (titulo: string) => (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
      <button onClick={voltar} className="text-muted-foreground">
        <ChevronRight className="h-5 w-5 rotate-180" />
      </button>
      <p className="font-display text-sm font-semibold text-foreground">{titulo}</p>
    </div>
  );

  // INICIO ────────────────────────────────────────────────────────────────────
  if (s.etapa === "inicio" && tarefa && s.produto) {
    return (
      <div className="flex min-h-full flex-col">
        {header("Nova reposição")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div
            className="rounded-xl p-5 text-white space-y-1"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            <p className="text-xs opacity-70">Tarefa de reposição</p>
            <p className="font-display text-lg font-bold">{s.produto.nome}</p>
            <p className="font-mono text-xs opacity-70">{s.produto.codigo}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Na gôndola", val: s.produto.gondola, warn: s.produto.gondola <= s.produto.minimo },
              { label: "Mínimo", val: s.produto.minimo, warn: false },
              { label: "No depósito", val: s.produto.deposito, warn: s.produto.deposito === 0 },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-xl p-3", item.warn ? "bg-destructive/10" : "bg-muted")}>
                <p className={cn("text-[10px]", item.warn ? "text-destructive" : "text-muted-foreground")}>{item.label}</p>
                <p className={cn("font-display text-2xl font-bold", item.warn ? "text-destructive" : "text-foreground")}>{item.val}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Sugestão de reposição</p>
            <p className="font-display text-3xl font-bold text-primary">{tarefa.qtdSugerida} <span className="text-base font-medium text-muted-foreground">unidades</span></p>
          </div>

          {s.produto.deposito === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Sem estoque no depósito</p>
                <p className="text-xs text-muted-foreground">Não é possível repor. Acione o setor de compras.</p>
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={() => up({ etapa: "deposito" })}
            disabled={s.produto.deposito === 0}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Iniciar reposição →
          </button>
        </div>
      </div>
    );
  }

  // DEPOSITO ─────────────────────────────────────────────────────────────────
  if (s.etapa === "deposito" && s.produto && locDep) {
    return (
      <div className="flex min-h-full flex-col">
        {header("Buscar no depósito")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Warehouse className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Vá buscar no depósito</p>
              <p className="text-xs text-muted-foreground">{s.produto.nome}</p>
            </div>
          </div>

          <LocalCard
            title="Localização no Depósito"
            icon={Warehouse}
            items={[
              { label: "Rua", val: locDep.rua },
              { label: "Prateleira", val: locDep.prateleira },
              { label: "Nível", val: locDep.nivel },
            ]}
          />

          {/* Mapa visual simplificado */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mapa do depósito</p>
            <div className="grid grid-cols-3 gap-2">
              {["R1","R2","R3"].map((r) => (
                <div
                  key={r}
                  className={cn(
                    "rounded-lg px-3 py-4 text-center text-sm font-bold transition-all",
                    r === locDep.rua
                      ? "border-2 border-primary bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "border border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {r}
                  {r === locDep.rua && <div className="mt-1 text-[10px] font-normal opacity-80">{locDep.prateleira} · Nív.{locDep.nivel}</div>}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">← Entrada do depósito</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Quantidade disponível</p>
            <p className="font-display text-3xl font-bold text-foreground">{s.produto.deposito} <span className="text-base font-medium text-muted-foreground">unidades</span></p>
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={() => up({ etapa: "scan" })}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Já busquei o produto →
          </button>
        </div>
      </div>
    );
  }

  // SCAN ──────────────────────────────────────────────────────────────────────
  if (s.etapa === "scan") {
    return (
      <div className="flex min-h-full flex-col">
        {header("Confirmar produto")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-primary/10">
            <ScanLine className="h-14 w-14 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-semibold text-foreground">Escaneie o código de barras</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tarefa ? "Confirme que está com o produto certo" : "Identifique o produto para repor"}
            </p>
          </div>
          <button
            onClick={() => up({ scanModal: true })}
            className="flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            <ZoomIn className="h-4 w-4" />
            Abrir scanner
          </button>
        </div>
      </div>
    );
  }

  // GONDOLA_LOC ──────────────────────────────────────────────────────────────
  if (s.etapa === "gondola_loc" && s.produto && locGon) {
    return (
      <div className="flex min-h-full flex-col">
        {header("Localização na gôndola")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Leve para a gôndola</p>
              <p className="text-xs text-muted-foreground">{s.produto.nome}</p>
            </div>
          </div>

          <LocalCard
            title="Localização na Gôndola"
            icon={MapPin}
            items={[
              { label: "Corredor", val: locGon.corredor },
              { label: "Gôndola", val: locGon.gondola },
              { label: "Nível", val: locGon.nivel },
              { label: "Posição", val: locGon.posicao },
            ]}
          />

          {/* Visual da gôndola */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nível na gôndola</p>
            <div className="flex flex-col gap-2">
              {(["Alto", "Médio", "Baixo"] as const).map((n) => (
                <div
                  key={n}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-4 py-3",
                    n === locGon.nivel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="text-sm font-semibold">{n}</span>
                  {n === locGon.nivel && (
                    <span className="text-xs opacity-80">← Posição {locGon.posicao}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={() => up({ etapa: "contagem", contagemInput: "" })}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Já estou na gôndola →
          </button>
        </div>
      </div>
    );
  }

  // CONTAGEM ─────────────────────────────────────────────────────────────────
  if (s.etapa === "contagem") {
    const qtd = parseInt(s.contagemInput, 10);
    const valido = !isNaN(qtd) && s.contagemInput !== "";
    return (
      <div className="flex min-h-full flex-col">
        {header("Contagem cega")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Contagem cega</p>
            <p className="text-sm text-foreground">Conta sem ver o número do sistema</p>
            <p className="text-xs text-muted-foreground">Quantos produtos já tem na gôndola <em>agora</em>?</p>
          </div>

          <div className="text-center">
            <p className="font-display text-7xl font-bold text-foreground tabular-nums">
              {s.contagemInput || "—"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{s.produto?.nome}</p>
          </div>

          <NumPad value={s.contagemInput} onChange={(v) => up({ contagemInput: v })} />
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={confirmarContagem}
            disabled={!valido}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Confirmar contagem
          </button>
        </div>
      </div>
    );
  }

  // RESULTADO ────────────────────────────────────────────────────────────────
  if (s.etapa === "resultado" && s.resultado && s.produto) {
    const { bateu, diferenca, sistema } = s.resultado;
    const contada = s.qtdContada ?? 0;
    return (
      <div className="flex min-h-full flex-col">
        {header("Resultado da contagem")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {bateu ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-success/10 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <div>
                <p className="font-display text-lg font-semibold text-success">Contagem correta!</p>
                <p className="text-sm text-muted-foreground">O sistema e a contagem batem.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-destructive/10 p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-display text-lg font-semibold text-destructive">Incoerência detectada!</p>
                <p className="text-sm text-muted-foreground">A contagem não bate com o sistema.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border bg-card p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground">Sistema diz</p>
              <p className="font-display text-2xl font-bold text-foreground">{sistema}</p>
            </div>
            <div className={cn("rounded-xl p-3 space-y-1 text-center", bateu ? "bg-success/10" : "bg-destructive/10")}>
              <p className={cn("text-[10px]", bateu ? "text-success" : "text-destructive")}>Você contou</p>
              <p className={cn("font-display text-2xl font-bold", bateu ? "text-success" : "text-destructive")}>{contada}</p>
            </div>
            <div className={cn("rounded-xl border p-3 space-y-1", bateu ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
              <p className={cn("text-[10px]", bateu ? "text-success" : "text-destructive")}>Diferença</p>
              <p className={cn("font-display text-2xl font-bold", bateu ? "text-success" : "text-destructive")}>
                {diferenca > 0 ? `+${diferenca}` : diferenca}
              </p>
            </div>
          </div>

          {!bateu && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-1">
              <p className="text-sm font-semibold text-destructive">Uma inconsistência será registrada</p>
              <p className="text-xs text-muted-foreground">
                {diferenca < 0
                  ? `Faltam ${Math.abs(diferenca)} unidades. Pode indicar furto, perda ou erro de movimentação.`
                  : `Há ${diferenca} unidades a mais. Pode indicar recebimento não registrado.`}
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={() => up({ etapa: "repor_qtd", reporInput: String(tarefa?.qtdSugerida ?? "") })}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Continuar para reposição →
          </button>
        </div>
      </div>
    );
  }

  // REPOR_QTD ────────────────────────────────────────────────────────────────
  if (s.etapa === "repor_qtd" && s.produto) {
    const qtd = parseInt(s.reporInput, 10);
    const maxRepor = s.produto.deposito;
    const valido = !isNaN(qtd) && qtd >= 0 && s.reporInput !== "" && qtd <= maxRepor;
    return (
      <div className="flex min-h-full flex-col">
        {header("Quantidade a repor")}
        <BarraEtapas etapa={s.etapa} temTarefa={!!tarefa} />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Disponível no depósito</p>
            <p className="font-display text-3xl font-bold text-foreground">{maxRepor} <span className="text-base font-medium text-muted-foreground">unidades</span></p>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">Quantos vai colocar na gôndola?</p>
            <p className="font-display text-7xl font-bold text-foreground tabular-nums">
              {s.reporInput || "—"}
            </p>
            {s.reporInput !== "" && !isNaN(qtd) && qtd > maxRepor && (
              <p className="text-xs text-destructive">Máximo disponível: {maxRepor} unidades</p>
            )}
          </div>

          <NumPad value={s.reporInput} onChange={(v) => up({ reporInput: v })} max={maxRepor} />
        </div>
        <div className="shrink-0 border-t border-border px-4 py-4">
          <button
            onClick={confirmarRepor}
            disabled={!valido}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Confirmar reposição
          </button>
        </div>
      </div>
    );
  }

  // SUCESSO ──────────────────────────────────────────────────────────────────
  if (s.etapa === "sucesso" && s.produto && s.resultado) {
    const qtdReposta = parseInt(s.reporInput, 10);
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            {s.resultado.bateu
              ? <CheckCircle2 className="h-10 w-10 text-white" />
              : <AlertTriangle className="h-10 w-10 text-white" />}
          </div>
          <div>
            <p className="font-display text-xl font-bold text-foreground">
              {s.resultado.bateu ? "Reposição concluída!" : "Reposição com divergência"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.produto.nome}</p>
          </div>

          <div className="w-full rounded-xl border border-border bg-card p-5 space-y-3 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contagem cega</span>
              <span className="font-semibold text-foreground">{s.qtdContada} unidades</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sistema dizia</span>
              <span className="font-semibold text-foreground">{s.resultado.sistema} unidades</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reposto</span>
              <span className="font-semibold text-primary">+{qtdReposta} unidades</span>
            </div>
            {!s.resultado.bateu && (
              <div className="flex justify-between text-sm border-t border-border pt-3">
                <span className="text-destructive">Divergência</span>
                <span className="font-semibold text-destructive">
                  {s.resultado.diferenca > 0 ? "+" : ""}{s.resultado.diferenca}
                </span>
              </div>
            )}
          </div>

          {!s.resultado.bateu && (
            <p className="text-xs text-muted-foreground">
              A inconsistência foi registrada e ficará visível no painel web para análise.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-4 space-y-3">
          <button
            onClick={() => navigate({ to: "/repositor/tarefas" })}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
          >
            Ver tarefas
          </button>
          <button
            onClick={() => navigate({ to: "/repositor" })}
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-foreground"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  // Fallback ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4">
      <Package className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Selecione uma tarefa para iniciar</p>
      <button
        onClick={() => up({ etapa: "scan" })}
        className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, oklch(0.24 0.06 230), oklch(0.45 0.1 215) 55%, oklch(0.72 0.14 180))" }}
      >
        Reposição avulsa (scanner)
      </button>
    </div>
  );
}
