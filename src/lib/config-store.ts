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
  emailNotificacoes: string; telefoneWhatsApp: string;
  alertaEstoqueZerado: boolean;
  alertaVencimentos: boolean;
  alertaPedidos: boolean;
  diasAlertaPedido: number;
  alertaAntifurto: boolean;
  limiteAntifurtoUnidades: number;
};

const PADRAO: Config = {
  nomeLoja: "", cnpj: "", cidade: "", uf: "",
  minimoPadrao: 10, margemPadrao: 45, toleranciaConferencia: 0,
  locaisDeposito: "C1, C2, C3, C4, Câmara fria",
  avisoVencimento1: 30, avisoVencimentoUrgente: 7,
  sugestaoPromocao: true, bloquearVencido: true,
  avisoRepositor: true, avisoInconsistencias: true,
  resumoDiario: false, avisosWhatsApp: false,
  emailNotificacoes: "", telefoneWhatsApp: "",
  alertaEstoqueZerado: true,
  alertaVencimentos: true,
  alertaPedidos: true,
  diasAlertaPedido: 2,
  alertaAntifurto: true,
  limiteAntifurtoUnidades: 2,
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
    .select("nome_loja, cnpj, cidade, uf, aviso_vencimento_1, aviso_vencimento_urgente, estoque_minimo_padrao, email_notificacoes, telefone_whatsapp, resumo_diario, avisos_whatsapp, margem_padrao, tolerancia_conferencia, locais_deposito, sugestao_promocao, bloquear_vencido, aviso_repositor, aviso_inconsistencias, alerta_estoque_zerado, alerta_vencimentos, alerta_pedidos, dias_alerta_pedido, alerta_antifurto, limite_antifurto_unidades")
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
      emailNotificacoes: data.email_notificacoes ?? "",
      telefoneWhatsApp: data.telefone_whatsapp ?? "",
      resumoDiario: data.resumo_diario ?? false,
      avisosWhatsApp: data.avisos_whatsapp ?? false,
      margemPadrao: data.margem_padrao ?? 45,
      toleranciaConferencia: data.tolerancia_conferencia ?? 0,
      locaisDeposito: data.locais_deposito ?? "C1, C2, C3, C4, Câmara fria",
      sugestaoPromocao: data.sugestao_promocao ?? true,
      bloquearVencido: data.bloquear_vencido ?? true,
      avisoRepositor: data.aviso_repositor ?? true,
      avisoInconsistencias: data.aviso_inconsistencias ?? true,
      alertaEstoqueZerado: data.alerta_estoque_zerado ?? true,
      alertaVencimentos: data.alerta_vencimentos ?? true,
      alertaPedidos: data.alerta_pedidos ?? true,
      diasAlertaPedido: data.dias_alerta_pedido ?? 2,
      alertaAntifurto: data.alerta_antifurto ?? true,
      limiteAntifurtoUnidades: data.limite_antifurto_unidades ?? 2,
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
      email_notificacoes: estado.emailNotificacoes,
      telefone_whatsapp: estado.telefoneWhatsApp,
      resumo_diario: estado.resumoDiario,
      avisos_whatsapp: estado.avisosWhatsApp,
      margem_padrao: estado.margemPadrao,
      tolerancia_conferencia: estado.toleranciaConferencia,
      locais_deposito: estado.locaisDeposito,
      sugestao_promocao: estado.sugestaoPromocao,
      bloquear_vencido: estado.bloquearVencido,
      aviso_repositor: estado.avisoRepositor,
      aviso_inconsistencias: estado.avisoInconsistencias,
      alerta_estoque_zerado: estado.alertaEstoqueZerado,
      alerta_vencimentos: estado.alertaVencimentos,
      alerta_pedidos: estado.alertaPedidos,
      dias_alerta_pedido: estado.diasAlertaPedido,
      alerta_antifurto: estado.alertaAntifurto,
      limite_antifurto_unidades: estado.limiteAntifurtoUnidades,
    })
    .eq("id", lojaId)
    .then(({ error }) => {
      if (error) toast.error("Erro ao salvar configurações: " + error.message);
    });
}
