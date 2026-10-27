import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { onLojaChange, getLojaId } from "./loja-resolver";

export type Config = {
  nomeLoja: string; cnpj: string; cidade: string; uf: string;
  minimoPadrao: number; margemPadrao: number; toleranciaConferencia: number; locaisDeposito: string;
  avisoVencimento1: number; avisoVencimentoUrgente: number;
  sugestaoPromocao: boolean; bloquearVencido: boolean;
  avisoRepositor: boolean; avisoInconsistencias: boolean;
  resumoDiario: boolean; avisosWhatsApp: boolean;
  alertaEstoqueZerado: boolean;
  alertaVencimentos: boolean;
  alertaPedidos: boolean;
  diasAlertaPedido: number;
};

const PADRAO: Config = {
  nomeLoja: "", cnpj: "", cidade: "", uf: "",
  minimoPadrao: 10, margemPadrao: 45, toleranciaConferencia: 0,
  locaisDeposito: "C1, C2, C3, C4, Câmara fria",
  avisoVencimento1: 30, avisoVencimentoUrgente: 7,
  sugestaoPromocao: true, bloquearVencido: true,
  avisoRepositor: true, avisoInconsistencias: true,
  resumoDiario: false, avisosWhatsApp: false,
  alertaEstoqueZerado: true,
  alertaVencimentos: true,
  alertaPedidos: true,
  diasAlertaPedido: 2,
};

let estado: Config = { ...PADRAO };
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

onLojaChange(async (lojaId) => {
  if (!lojaId) {
    estado = { ...PADRAO };
    notificar();
    return;
  }
  const { data } = await supabase
    .from("lojas")
    .select("nome_loja, cnpj, cidade, uf, aviso_vencimento_1, aviso_vencimento_urgente, estoque_minimo_padrao")
    .eq("id", lojaId)
    .single();
  if (data) {
    estado = {
      ...estado,
      nomeLoja: data.nome_loja ?? "",
      cnpj: data.cnpj ?? "",
      cidade: data.cidade ?? "",
      uf: data.uf ?? "",
      avisoVencimento1: data.aviso_vencimento_1 ?? 30,
      avisoVencimentoUrgente: data.aviso_vencimento_urgente ?? 7,
      minimoPadrao: data.estoque_minimo_padrao ?? 10,
    };
    notificar();
  }
});

export function useConfig(): Config {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => estado,
  );
}

export function getConfig(): Config { return estado; }

export function salvarConfig(parcial: Partial<Config>): void {
  estado = { ...estado, ...parcial };
  notificar();
  const lojaId = getLojaId();
  if (!lojaId) return;
  supabase
    .from("lojas")
    .update({
      nome_loja: estado.nomeLoja,
      cnpj: estado.cnpj,
      cidade: estado.cidade,
      uf: estado.uf,
      aviso_vencimento_1: estado.avisoVencimento1,
      aviso_vencimento_urgente: estado.avisoVencimentoUrgente,
      estoque_minimo_padrao: estado.minimoPadrao,
    })
    .eq("id", lojaId)
    .then(({ error }) => {
      if (error) toast.error("Erro ao salvar configurações: " + error.message);
    });
}
