import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

const CHAVE = "omni:tema";

function lerLocal(): "claro" | "escuro" | null {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "escuro") return "escuro";
    if (v === "claro") return "claro";
  } catch { /* */ }
  return null;
}

function prefereSistema(): "claro" | "escuro" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

function aplicar(t: "claro" | "escuro") {
  document.documentElement.classList.toggle("dark", t === "escuro");
}

// Aplica imediatamente a partir do localStorage para evitar flash
let tema: "claro" | "escuro" = lerLocal() ?? prefereSistema();
aplicar(tema);

const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

// Após autenticação carrega o tema salvo na conta (cross-device)
supabase.auth.getSession().then(({ data }) => {
  const saved = data.session?.user?.user_metadata?.tema;
  if (saved === "claro" || saved === "escuro") {
    if (saved !== tema) {
      tema = saved;
      aplicar(tema);
      try { localStorage.setItem(CHAVE, tema); } catch { /* */ }
      notificar();
    }
  }
});

export function useTema() {
  return useSyncExternalStore(
    (cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); },
    () => tema,
  );
}

export function alternarTema() {
  tema = tema === "claro" ? "escuro" : "claro";
  aplicar(tema);
  try { localStorage.setItem(CHAVE, tema); } catch { /* */ }
  notificar();
  // Persiste no perfil do usuário para sincronizar em outros dispositivos
  supabase.auth.updateUser({ data: { tema } }).catch(() => {});
}
