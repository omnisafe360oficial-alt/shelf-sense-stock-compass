import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

export type Lote = { id: string; produtoId: string; lote: string; validade: string; qtd: number; local: string };
export type Mov = { id: string; data: string; tipo: "entrada" | "transferencia" | "venda" | "ajuste"; produtoId: string; lote?: string; qtd: number; origem: string; destino: string; usuario: string; precoUnitario?: number };

type Estado = { lotes: Lote[]; gondola: Record<string, number>; movs: Mov[] };

const VAZIO: Estado = { lotes: [], gondola: {}, movs: [] };

let estado: Estado = { ...VAZIO };
const ouvintes = new Set<() => void>();
const emitir = (novo: Estado) => { estado = novo; ouvintes.forEach((o) => o()); };

// ─── Carregamento + Realtime ──────────────────────────────────────────────────

let gondolaChannel: ReturnType<typeof supabase.channel> | null = null;

onLojaChange(async (lojaId) => {
  if (gondolaChannel) {
    await supabase.removeChannel(gondolaChannel);
    gondolaChannel = null;
  }
  if (!lojaId) { emitir({ ...VAZIO }); return; }

  const [lotesRes, gondolaRes, movsRes] = await Promise.all([
    supabase.from("lotes").select("id, produto_id, lote, validade, qtd, local").eq("loja_id", lojaId).order("validade"),
    supabase.from("gondola").select("produto_id, qtd_gondola").eq("loja_id", lojaId),
    supabase.from("movimentacoes").select("id, data, tipo, produto_id, lote, qtd, origem, destino, usuario_nome").eq("loja_id", lojaId).order("data", { ascending: false }).limit(500),
  ]);

  if (lotesRes.error) toast.error("Erro ao carregar lotes");
  if (gondolaRes.error) toast.error("Erro ao carregar gôndola");
  if (movsRes.error) toast.error("Erro ao carregar movimentações");

  const lotes: Lote[] = (lotesRes.data ?? []).map((r) => ({
    id: r.id as string,
    produtoId: r.produto_id as string,
    lote: r.lote as string,
    validade: r.validade as string,
    qtd: r.qtd as number,
    local: (r.local as string) ?? "",
  }));

  const gondola: Record<string, number> = {};
  for (const r of gondolaRes.data ?? []) {
    gondola[r.produto_id as string] = (r.qtd_gondola as number) ?? 0;
  }

  const movs: Mov[] = (movsRes.data ?? []).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    tipo: r.tipo as Mov["tipo"],
    produtoId: r.produto_id as string,
    lote: (r.lote as string) ?? undefined,
    qtd: r.qtd as number,
    origem: (r.origem as string) ?? "",
    destino: (r.destino as string) ?? "",
    usuario: (r.usuario_nome as string) ?? "",
  }));

  emitir({ lotes, gondola, movs });

  gondolaChannel = supabase
    .channel(`gondola-rt-${lojaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "gondola", filter: `loja_id=eq.${lojaId}` }, (payload) => {
      if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
        const row = payload.new as { produto_id: string; qtd_gondola: number };
        emitir({ ...estado, gondola: { ...estado.gondola, [row.produto_id]: row.qtd_gondola } });
      }
    })
    .subscribe();
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEstoque() {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => estado, () => estado);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const lotesFefo = (s: Estado, produtoId: string) =>
  s.lotes.filter((l) => l.produtoId === produtoId && l.qtd > 0).sort((a, b) => a.validade.localeCompare(b.validade));

export const diasAte = (iso: string, hoje = new Date()) => Math.round((new Date(iso).getTime() - hoje.getTime()) / 86400000);

export type Faixa = "vencido" | "7" | "15" | "30" | "ok";
export function faixaValidade(dias: number): Faixa {
  if (dias < 0) return "vencido";
  if (dias <= 7) return "7";
  if (dias <= 15) return "15";
  if (dias <= 30) return "30";
  return "ok";
}

export const estadoAtual = () => estado;

// ─── Persistência assíncrona ──────────────────────────────────────────────────

function persistirGondola(lojaId: string, produtoId: string, qtd: number) {
  supabase
    .from("gondola")
    .upsert({ loja_id: lojaId, produto_id: produtoId, qtd_gondola: qtd, updated_at: new Date().toISOString() }, { onConflict: "loja_id,produto_id" })
    .then(({ error }) => { if (error) toast.error("Erro ao salvar gôndola: " + error.message); });
}

function persistirLote(lojaId: string, lote: Lote) {
  supabase
    .from("lotes")
    .upsert({ id: lote.id, loja_id: lojaId, produto_id: lote.produtoId, lote: lote.lote, validade: lote.validade, qtd: lote.qtd, local: lote.local })
    .then(({ error }) => { if (error) toast.error("Erro ao salvar lote: " + error.message); });
}

function persistirMov(lojaId: string, mov: Mov) {
  supabase
    .from("movimentacoes")
    .insert({ id: mov.id, loja_id: lojaId, data: mov.data, tipo: mov.tipo, produto_id: mov.produtoId, lote: mov.lote ?? null, qtd: mov.qtd, origem: mov.origem, destino: mov.destino, usuario_nome: mov.usuario, preco_unitario: mov.precoUnitario ?? 0 })
    .then(({ error }) => { if (error) toast.error("Erro ao registrar movimentação: " + error.message); });
}

// ─── Transferência ────────────────────────────────────────────────────────────

export function transferir(s: Estado, produtoId: string, qtd: number): { estado: Estado; movidos: { lote: string; qtd: number }[] } {
  const disponivel = lotesFefo(s, produtoId).reduce((t, l) => t + l.qtd, 0);
  if (qtd <= 0 || qtd > disponivel) throw new Error(`Quantidade indisponível no depósito (máx. ${disponivel}).`);
  let falta = qtd;
  const movidos: { lote: string; qtd: number }[] = [];
  const ordem = lotesFefo(s, produtoId).map((l) => l.id);
  const lotes = s.lotes.map((l) => ({ ...l }));
  for (const id of ordem) {
    const l = lotes.find((x) => x.id === id)!;
    const tira = Math.min(l.qtd, falta);
    l.qtd -= tira; falta -= tira; movidos.push({ lote: l.lote, qtd: tira });
    if (!falta) break;
  }
  const agora = new Date().toISOString().slice(0, 16);
  const novos: Mov[] = movidos.map((m, i) => ({
    id: crypto.randomUUID(),
    data: agora,
    tipo: "transferencia",
    produtoId,
    lote: m.lote,
    qtd: m.qtd,
    origem: "Depósito",
    destino: "Gôndola",
    usuario: "Sistema",
  }));
  return { estado: { lotes, gondola: { ...s.gondola, [produtoId]: (s.gondola[produtoId] ?? 0) + qtd }, movs: [...novos, ...s.movs] }, movidos };
}

export function executarTransferencia(produtoId: string, qtd: number) {
  const r = transferir(estado, produtoId, qtd);
  emitir(r.estado);
  const lojaId = getLojaId();
  if (lojaId) {
    // Persiste lotes modificados
    const lotesAntigos = estado.lotes.filter((l) => l.produtoId === produtoId);
    for (const l of lotesAntigos) persistirLote(lojaId, l);
    // Persiste gondola
    persistirGondola(lojaId, produtoId, r.estado.gondola[produtoId] ?? 0);
    // Persiste movs
    const novosMovs = r.estado.movs.slice(0, r.movidos.length);
    for (const m of novosMovs) persistirMov(lojaId, m);
  }
  return r.movidos;
}

// ─── Perda ────────────────────────────────────────────────────────────────────

export function registrarPerda(loteId: string, motivo: string) {
  const l = estado.lotes.find((x) => x.id === loteId);
  if (!l || l.qtd <= 0) return;
  const mov: Mov = { id: crypto.randomUUID(), data: new Date().toISOString().slice(0, 16), tipo: "ajuste", produtoId: l.produtoId, lote: l.lote, qtd: -l.qtd, origem: "Depósito", destino: `Perda (${motivo})`, usuario: "Sistema" };
  const novoEstado = { ...estado, lotes: estado.lotes.map((x) => (x.id === loteId ? { ...x, qtd: 0 } : x)), movs: [mov, ...estado.movs] };
  emitir(novoEstado);
  const lojaId = getLojaId();
  if (lojaId) {
    persistirLote(lojaId, { ...l, qtd: 0 });
    persistirMov(lojaId, mov);
  }
}

// ─── Venda ────────────────────────────────────────────────────────────────────

export type ItemVenda = { produtoId: string; qtd: number; preco?: number };

export function vender(s: Estado, itens: ItemVenda[], caixa: string, minimos: Record<string, number>): { estado: Estado; repor: string[] } {
  if (!itens.length) throw new Error("Nenhum item na venda.");
  const gondola = { ...s.gondola };
  for (const i of itens) {
    if (i.qtd <= 0) throw new Error("Quantidade inválida.");
    if ((gondola[i.produtoId] ?? 0) < i.qtd) throw new Error("Quantidade maior que a gôndola.");
    gondola[i.produtoId] = (gondola[i.produtoId] ?? 0) - i.qtd;
  }
  const agora = new Date().toISOString().slice(0, 16);
  const novos: Mov[] = itens.map((i) => ({ id: crypto.randomUUID(), data: agora, tipo: "venda", produtoId: i.produtoId, qtd: i.qtd, origem: "Gôndola", destino: `PDV · ${caixa}`, usuario: `Caixa · ${caixa}`, precoUnitario: i.preco ?? 0 }));
  const repor = itens.filter((i) => (gondola[i.produtoId] ?? 0) <= (minimos[i.produtoId] ?? 0) && (s.gondola[i.produtoId] ?? 0) > (minimos[i.produtoId] ?? 0)).map((i) => i.produtoId);
  return { estado: { ...s, gondola, movs: [...novos, ...s.movs] }, repor };
}

export function fecharVenda(itens: ItemVenda[], caixa: string, minimos: Record<string, number>) {
  const r = vender(estado, itens, caixa, minimos);
  emitir(r.estado);
  const lojaId = getLojaId();
  if (lojaId) {
    for (const i of itens) {
      persistirGondola(lojaId, i.produtoId, r.estado.gondola[i.produtoId] ?? 0);
    }
    for (const m of r.estado.movs.slice(0, itens.length)) persistirMov(lojaId, m);
  }
  return r.repor;
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export function registrarEntrada(produtoId: string, qtd: number, lote: string, validade: string, origem: string, usuario: string) {
  if (qtd <= 0) return;
  const novoLote: Lote = { id: crypto.randomUUID(), produtoId, lote, validade, qtd, local: "Doca de recebimento" };
  const mov: Mov = { id: crypto.randomUUID(), data: new Date().toISOString().slice(0, 16), tipo: "entrada", produtoId, lote, qtd, origem, destino: "Depósito", usuario };
  emitir({ ...estado, lotes: [...estado.lotes, novoLote], movs: [mov, ...estado.movs] });
  const lojaId = getLojaId();
  if (lojaId) {
    persistirLote(lojaId, novoLote);
    persistirMov(lojaId, mov);
  }
}

// ─── Ajuste de gôndola ────────────────────────────────────────────────────────

export function ajustarGondola(produtoId: string, contado: number, motivo: string) {
  const atual = estado.gondola[produtoId] ?? 0;
  if (atual === contado) return;
  const mov: Mov = { id: crypto.randomUUID(), data: new Date().toISOString().slice(0, 16), tipo: "ajuste", produtoId, qtd: contado - atual, origem: "Gôndola", destino: motivo, usuario: "Sistema" };
  emitir({ ...estado, gondola: { ...estado.gondola, [produtoId]: contado }, movs: [mov, ...estado.movs] });
  const lojaId = getLojaId();
  if (lojaId) {
    persistirGondola(lojaId, produtoId, contado);
    persistirMov(lojaId, mov);
  }
}

// ─── Inicializar produto novo ─────────────────────────────────────────────────

export function inicializarProduto(produtoId: string) {
  if (estado.gondola[produtoId] !== undefined) return;
  emitir({ ...estado, gondola: { ...estado.gondola, [produtoId]: 0 } });
  const lojaId = getLojaId();
  if (lojaId) persistirGondola(lojaId, produtoId, 0);
}
