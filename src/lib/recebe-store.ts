import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";
import { produtos as CATALOGO } from "./mock-data";

export { CATALOGO as CATALOGO_PRODUTOS };

export type RecebeUnidade = "UN" | "CX" | "FD" | "PCT" | "SC" | "DZ" | "BD" | "KG" | "GR" | "L" | "ML" | "GF";

export const UNIDADES_CONFIG: {
  value: RecebeUnidade;
  label: string;
  fatorFixo?: number;
  nomeCompleto: string;
  precisaFator: boolean;
}[] = [
  { value: "UN", label: "UN", fatorFixo: 1, nomeCompleto: "Unidade", precisaFator: false },
  { value: "CX", label: "CX", nomeCompleto: "Caixa", precisaFator: true },
  { value: "FD", label: "FD", nomeCompleto: "Fardo", precisaFator: true },
  { value: "PCT", label: "PCT", nomeCompleto: "Pacote", precisaFator: true },
  { value: "SC", label: "SC", nomeCompleto: "Saco", precisaFator: true },
  { value: "DZ", label: "DZ", fatorFixo: 12, nomeCompleto: "Dúzia", precisaFator: false },
  { value: "BD", label: "BD", nomeCompleto: "Balde", precisaFator: true },
  { value: "KG", label: "KG", fatorFixo: 1, nomeCompleto: "Quilo", precisaFator: false },
  { value: "GR", label: "GR", fatorFixo: 1, nomeCompleto: "Grama", precisaFator: false },
  { value: "L", label: "L", fatorFixo: 1, nomeCompleto: "Litro", precisaFator: false },
  { value: "ML", label: "ML", fatorFixo: 1, nomeCompleto: "Mililitro", precisaFator: false },
  { value: "GF", label: "GF", nomeCompleto: "Garrafa", precisaFator: true },
];

export type ItemRecebimento = {
  id: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  unidade: RecebeUnidade;
  fator: number;
  qtdContada: number;
  qtdUN: number;
  qtdEsperada?: number;
  lote: string;
  validade: string;
  observacao: string;
};

export type PedidoStatus = "enviado" | "confirmado" | "parcial" | "recebido" | "cancelado";

export type ItemPedidoMock = {
  produtoId: string;
  qtdSolicitada: number;
  unidade: string;
  qtdRecebida: number;
};

export type PedidoMock = {
  id: string;
  numero: string;
  fornecedor: string;
  status: PedidoStatus;
  dataPrevista: string;
  itens: ItemPedidoMock[];
};

export type Recebimento = {
  id: string;
  data: string;
  fornecedor: string;
  pedidoId?: string;
  pedidoNumero?: string;
  operador: string;
  itens: ItemRecebimento[];
  observacaoGeral: string;
  totalDivergencias: number;
};

type Estado = {
  pedidos: PedidoMock[];
  recebimentos: Recebimento[];
  carregando: boolean;
};

const PEDIDOS_INICIAIS: PedidoMock[] = [
  {
    id: "pc1",
    numero: "PC-20241001",
    fornecedor: "Distribuidora Camil",
    status: "enviado",
    dataPrevista: "Hoje",
    itens: [
      { produtoId: "3", qtdSolicitada: 40, unidade: "UN", qtdRecebida: 0 },
      { produtoId: "7", qtdSolicitada: 60, unidade: "UN", qtdRecebida: 0 },
    ],
  },
  {
    id: "pc2",
    numero: "PC-20241002",
    fornecedor: "Unilever Brasil",
    status: "confirmado",
    dataPrevista: "Hoje",
    itens: [
      { produtoId: "4", qtdSolicitada: 48, unidade: "UN", qtdRecebida: 0 },
      { produtoId: "6", qtdSolicitada: 36, unidade: "UN", qtdRecebida: 0 },
    ],
  },
  {
    id: "pc3",
    numero: "PC-20241003",
    fornecedor: "Laticínios Serra Verde",
    status: "enviado",
    dataPrevista: "Amanhã",
    itens: [
      { produtoId: "2", qtdSolicitada: 120, unidade: "UN", qtdRecebida: 0 },
      { produtoId: "5", qtdSolicitada: 72, unidade: "UN", qtdRecebida: 0 },
    ],
  },
];

let estado: Estado = { pedidos: PEDIDOS_INICIAIS, recebimentos: [], carregando: false };
const ouvintes = new Set<() => void>();
const emitir = (n: Estado) => { estado = n; ouvintes.forEach((o) => o()); };

function mapRecebimento(row: Record<string, unknown>): Recebimento {
  return {
    id: row.id as string,
    data: row.data as string,
    fornecedor: row.fornecedor as string,
    pedidoId: (row.pedido_id as string) ?? undefined,
    pedidoNumero: (row.pedido_numero as string) ?? undefined,
    operador: row.operador as string,
    itens: (row.itens as ItemRecebimento[]) ?? [],
    observacaoGeral: (row.observacao_geral as string) ?? "",
    totalDivergencias: (row.total_divergencias as number) ?? 0,
  };
}

onLojaChange(async (lojaId) => {
  if (!lojaId) {
    emitir({ ...estado, recebimentos: [] });
    return;
  }
  const { data, error } = await supabase
    .from("recebimentos")
    .select("*")
    .eq("loja_id", lojaId)
    .order("data", { ascending: false })
    .limit(200);
  if (error) toast.error("Erro ao carregar recebimentos");
  emitir({ ...estado, recebimentos: (data ?? []).map(mapRecebimento), carregando: false });
});

export function useRecebeEstado() {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
    () => estado,
  );
}

export function getRecebeEstado() {
  return estado;
}

export function finalizarRecebimento(rec: Omit<Recebimento, "id" | "data">) {
  const lojaId = getLojaId();
  const novo: Recebimento = {
    ...rec,
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
  };

  let pedidos = estado.pedidos;
  if (rec.pedidoId) {
    pedidos = estado.pedidos.map((p) => {
      if (p.id !== rec.pedidoId) return p;
      const itensAtualizados = p.itens.map((item) => {
        const recebido = rec.itens.find((i) => i.produtoId === item.produtoId);
        if (!recebido) return item;
        return { ...item, qtdRecebida: item.qtdRecebida + recebido.qtdUN };
      });
      const tudo = itensAtualizados.every((i) => i.qtdRecebida >= i.qtdSolicitada);
      const algo = itensAtualizados.some((i) => i.qtdRecebida > 0);
      const novoStatus: PedidoStatus = tudo ? "recebido" : algo ? "parcial" : p.status;
      return { ...p, itens: itensAtualizados, status: novoStatus };
    });
  }
  emitir({ ...estado, pedidos, recebimentos: [novo, ...estado.recebimentos] });

  if (lojaId) {
    supabase.from("recebimentos").insert({
      id: novo.id,
      loja_id: lojaId,
      data: novo.data,
      fornecedor: novo.fornecedor,
      pedido_id: novo.pedidoId ?? null,
      pedido_numero: novo.pedidoNumero ?? null,
      operador: novo.operador,
      itens: novo.itens,
      observacao_geral: novo.observacaoGeral,
      total_divergencias: novo.totalDivergencias,
    }).then(({ error }) => { if (error) toast.error("Erro ao salvar recebimento: " + error.message); });
  }

  return novo;
}
