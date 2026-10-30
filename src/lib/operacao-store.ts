import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ajustarGondola, estadoAtual, executarTransferencia, registrarEntrada } from "@/lib/estoque-store";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { gravarAudit } from "./audit-store";

export type Inconsistencia = {
  id: string; data: string; origem: "Reposição" | "Recebimento"; produtoId: string;
  sistema: number; contado: number; referencia: string; usuario: string;
  status: "aberta" | "ajustada" | "mantida";
};
export type ItemNota = { produtoId: string; caixas: number; fator: number; embalagem: string; lote: string; validade: string };
export type Nota = { id: string; numero: string; fornecedor: string; chegada: string; itens: ItemNota[]; status: "aguardando" | "conferida" | "divergente" };
export type Conferencia = { id: string; data: string; produtoId: string; sistema: number; encontrado: number; reposto: number; usuario: string };

type Estado = { notas: Nota[]; inconsistencias: Inconsistencia[]; conferencias: Conferencia[] };

const VAZIO: Estado = { notas: [], inconsistencias: [], conferencias: [] };

let estado: Estado = { ...VAZIO };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

// ─── Carregamento + Realtime ──────────────────────────────────────────────────

let inconsChannel: ReturnType<typeof supabase.channel> | null = null;

onLojaChange(async (lojaId) => {
  if (inconsChannel) {
    await supabase.removeChannel(inconsChannel);
    inconsChannel = null;
  }
  if (!lojaId) { emitir({ ...VAZIO }); return; }

  const [notasRes, inconsRes, confRes] = await Promise.all([
    supabase
      .from("notas")
      .select("id, numero, fornecedor_nome, chegada, status, itens_nota(produto_id, caixas, fator, embalagem, lote, validade)")
      .eq("loja_id", lojaId)
      .order("chegada", { ascending: false })
      .limit(200),
    supabase
      .from("inconsistencias")
      .select("id, data, origem, produto_id, sistema, contado, referencia, usuario_nome, status")
      .eq("loja_id", lojaId)
      .order("data", { ascending: false })
      .limit(200),
    supabase
      .from("conferencias")
      .select("id, data, produto_id, sistema, encontrado, reposto, usuario_nome")
      .eq("loja_id", lojaId)
      .order("data", { ascending: false })
      .limit(200),
  ]);

  if (notasRes.error) toast.error("Erro ao carregar notas fiscais");
  if (inconsRes.error) toast.error("Erro ao carregar inconsistências");
  if (confRes.error) toast.error("Erro ao carregar conferências");

  const notas: Nota[] = (notasRes.data ?? []).map((r) => ({
    id: r.id as string,
    numero: (r.numero as string) ?? "",
    fornecedor: (r.fornecedor_nome as string) ?? "",
    chegada: (r.chegada as string) ?? "",
    status: (r.status as Nota["status"]) ?? "aguardando",
    itens: ((r.itens_nota as unknown[]) ?? []).map((i: unknown) => {
      const item = i as Record<string, unknown>;
      return {
        produtoId: item.produto_id as string,
        caixas: (item.caixas as number) ?? 0,
        fator: (item.fator as number) ?? 1,
        embalagem: (item.embalagem as string) ?? "",
        lote: (item.lote as string) ?? "",
        validade: (item.validade as string) ?? "",
      };
    }),
  }));

  const inconsistencias: Inconsistencia[] = (inconsRes.data ?? []).map((r) => ({
    id: r.id as string,
    data: (r.data as string) ?? "",
    origem: (r.origem as Inconsistencia["origem"]) ?? "Recebimento",
    produtoId: r.produto_id as string,
    sistema: (r.sistema as number) ?? 0,
    contado: (r.contado as number) ?? 0,
    referencia: (r.referencia as string) ?? "",
    usuario: (r.usuario_nome as string) ?? "",
    status: (r.status as Inconsistencia["status"]) ?? "aberta",
  }));

  const conferencias: Conferencia[] = (confRes.data ?? []).map((r) => ({
    id: r.id as string,
    data: (r.data as string) ?? "",
    produtoId: r.produto_id as string,
    sistema: (r.sistema as number) ?? 0,
    encontrado: (r.encontrado as number) ?? 0,
    reposto: (r.reposto as number) ?? 0,
    usuario: (r.usuario_nome as string) ?? "",
  }));

  emitir({ notas, inconsistencias, conferencias });

  inconsChannel = supabase
    .channel(`incons-rt-${lojaId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "inconsistencias", filter: `loja_id=eq.${lojaId}` }, (payload) => {
      const r = payload.new as Record<string, unknown>;
      const nova: Inconsistencia = {
        id: r.id as string, data: (r.data as string) ?? "",
        origem: (r.origem as Inconsistencia["origem"]) ?? "Recebimento",
        produtoId: r.produto_id as string, sistema: (r.sistema as number) ?? 0,
        contado: (r.contado as number) ?? 0, referencia: (r.referencia as string) ?? "",
        usuario: (r.usuario_nome as string) ?? "", status: (r.status as Inconsistencia["status"]) ?? "aberta",
      };
      if (!estado.inconsistencias.find((i) => i.id === nova.id)) {
        emitir({ ...estado, inconsistencias: [nova, ...estado.inconsistencias] });
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inconsistencias", filter: `loja_id=eq.${lojaId}` }, (payload) => {
      const r = payload.new as Record<string, unknown>;
      emitir({ ...estado, inconsistencias: estado.inconsistencias.map((i) => i.id === r.id ? { ...i, status: r.status as Inconsistencia["status"] } : i) });
    })
    .subscribe();
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOperacao() {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => estado, () => estado);
}

const agora = () => new Date().toISOString().slice(0, 16);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const emUnidades = (embalagens: number, fator: number, avulsas: number) => embalagens * fator + avulsas;

export function compararNota(nota: Nota, contado: Record<string, number>) {
  return nota.itens.map((i) => {
    const esperado = i.caixas * i.fator;
    const c = contado[i.produtoId] ?? 0;
    return { produtoId: i.produtoId, esperado, contado: c, diferenca: c - esperado };
  });
}

// ─── Conferência de nota ──────────────────────────────────────────────────────

export function conferirNota(notaId: string, contado: Record<string, number>, usuario: string) {
  const nota = estado.notas.find((n) => n.id === notaId);
  if (!nota || nota.status !== "aguardando") return [];
  const r = compararNota(nota, contado);
  nota.itens.forEach((i) => registrarEntrada(i.produtoId, contado[i.produtoId] ?? 0, i.lote, i.validade, nota.numero, usuario));
  const novas: Inconsistencia[] = r.filter((x) => x.diferenca !== 0).map((x) => ({
    id: crypto.randomUUID(), data: agora(), origem: "Recebimento", produtoId: x.produtoId, sistema: x.esperado, contado: x.contado,
    referencia: nota.numero, usuario, status: "aberta",
  }));
  const novoStatus: Nota["status"] = novas.length ? "divergente" : "conferida";
  emitir({
    ...estado,
    notas: estado.notas.map((n) => (n.id === notaId ? { ...n, status: novoStatus } : n)),
    inconsistencias: [...novas, ...estado.inconsistencias],
  });
  const lojaId = getLojaId();
  if (lojaId) {
    supabase.from("notas").update({ status: novoStatus }).eq("id", notaId)
      .then(({ error }) => { if (error) toast.error("Erro ao atualizar nota: " + error.message); });
    for (const inc of novas) {
      supabase.from("inconsistencias").insert({
        id: inc.id, loja_id: lojaId, data: inc.data, origem: inc.origem,
        produto_id: inc.produtoId, sistema: inc.sistema, contado: inc.contado,
        referencia: inc.referencia, usuario_nome: inc.usuario, status: inc.status,
      }).then(({ error }) => { if (error) toast.error("Erro ao registrar inconsistência: " + error.message); });
    }
    gravarAudit({
      acao: "receber",
      modulo: "Recebimento",
      descricao: `Nota "${nota.numero}" conferida por ${usuario} — status: ${novoStatus}, divergências: ${novas.length}.`,
      usuarioNome: usuario,
    });
  }
  return novas;
}

// ─── Conferência de reposição ─────────────────────────────────────────────────

export function conferirReposicao(produtoId: string, encontrado: number, reposto: number, usuario: string) {
  const sistema = estadoAtual().gondola[produtoId] ?? 0;
  if (reposto > 0) executarTransferencia(produtoId, reposto);
  const conf: Conferencia = { id: crypto.randomUUID(), data: agora(), produtoId, sistema, encontrado, reposto, usuario };
  const nova: Inconsistencia[] = encontrado === sistema ? [] : [{
    id: crypto.randomUUID(), data: agora(), origem: "Reposição", produtoId, sistema, contado: encontrado,
    referencia: "Gôndola", usuario, status: "aberta",
  }];
  emitir({ ...estado, conferencias: [conf, ...estado.conferencias], inconsistencias: [...nova, ...estado.inconsistencias] });
  const lojaId = getLojaId();
  if (lojaId) {
    supabase.from("conferencias").insert({
      id: conf.id, loja_id: lojaId, data: conf.data, produto_id: conf.produtoId,
      sistema: conf.sistema, encontrado: conf.encontrado, reposto: conf.reposto, usuario_nome: conf.usuario,
    }).then(({ error }) => { if (error) toast.error("Erro ao registrar conferência: " + error.message); });
    for (const inc of nova) {
      supabase.from("inconsistencias").insert({
        id: inc.id, loja_id: lojaId, data: inc.data, origem: inc.origem,
        produto_id: inc.produtoId, sistema: inc.sistema, contado: inc.contado,
        referencia: inc.referencia, usuario_nome: inc.usuario, status: inc.status,
      }).then(({ error }) => { if (error) toast.error("Erro ao registrar inconsistência: " + error.message); });
    }
    gravarAudit({
      acao: nova.length === 0 ? "ajuste" : "ajuste",
      modulo: "Reposição",
      descricao: `Conferência de gôndola por ${usuario} — sistema: ${sistema}, encontrado: ${encontrado}, reposto: ${reposto}${nova.length ? ", divergência registrada" : ", sem divergências"}.`,
      usuarioNome: usuario,
    });
  }
  return nova.length === 0;
}

// ─── Resolver inconsistência ──────────────────────────────────────────────────

export function registrarInconsistenciaPedido(produtoId: string, sistema: number, contado: number, referencia: string, usuario: string): void {
  const id = crypto.randomUUID();
  const inc: Inconsistencia = { id, data: new Date().toISOString().slice(0, 16), origem: "Recebimento", produtoId, sistema, contado, referencia, usuario, status: "aberta" };
  emitir({ ...estado, inconsistencias: [inc, ...estado.inconsistencias] });
  const lojaId = getLojaId();
  if (!lojaId) return;
  supabase.from("inconsistencias").insert({
    id: inc.id, loja_id: lojaId, data: inc.data, origem: inc.origem,
    produto_id: inc.produtoId, sistema: inc.sistema, contado: inc.contado,
    referencia: inc.referencia, usuario_nome: inc.usuario, status: inc.status,
  }).then(({ error }) => { if (error) toast.error("Erro ao registrar inconsistência: " + error.message); });
}

export function resolverInconsistencia(id: string, acao: "ajustar" | "manter") {
  const inc = estado.inconsistencias.find((i) => i.id === id);
  if (!inc || inc.status !== "aberta") return;
  if (acao === "ajustar" && inc.origem === "Reposição") {
    const atual = estadoAtual().gondola[inc.produtoId] ?? 0;
    ajustarGondola(inc.produtoId, Math.max(0, atual + (inc.contado - inc.sistema)), "Ajuste de inconsistência");
  }
  const novoStatus = acao === "ajustar" ? "ajustada" : "mantida";
  emitir({ ...estado, inconsistencias: estado.inconsistencias.map((i) => (i.id === id ? { ...i, status: novoStatus } : i)) });
  supabase.from("inconsistencias").update({ status: novoStatus }).eq("id", id)
    .then(({ error }) => {
      if (error) toast.error("Erro ao resolver inconsistência: " + error.message);
      else gravarAudit({ acao: "ajuste", modulo: "Inconsistências", descricao: `Inconsistência (${inc.origem}) ${novoStatus} — produto: ${inc.produtoId}, sistema: ${inc.sistema}, contado: ${inc.contado}.`, usuarioNome: "Sistema" });
    });
}
