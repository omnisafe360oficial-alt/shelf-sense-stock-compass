import { useSyncExternalStore } from "react";

export type Config = {
  nomeLoja: string; cnpj: string; cidade: string; uf: string;
  minimoPadrao: number; margemPadrao: number; toleranciaConferencia: number; locaisDeposito: string;
  avisoVencimento1: number; avisoVencimentoUrgente: number;
  sugestaoPromocao: boolean; bloquearVencido: boolean;
  avisoRepositor: boolean; avisoInconsistencias: boolean;
  resumoDiario: boolean; avisosWhatsApp: boolean;
};

const PADRAO: Config = {
  nomeLoja: "Mercado Bom Preço", cnpj: "12.345.678/0001-90", cidade: "Campinas", uf: "SP",
  minimoPadrao: 10, margemPadrao: 45, toleranciaConferencia: 0,
  locaisDeposito: "C1, C2, C3, C4, Câmara fria",
  avisoVencimento1: 30, avisoVencimentoUrgente: 7,
  sugestaoPromocao: true, bloquearVencido: true,
  avisoRepositor: true, avisoInconsistencias: true,
  resumoDiario: false, avisosWhatsApp: false,
};

let estado: Config = { ...PADRAO };
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

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
}
