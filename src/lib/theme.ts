import { useSyncExternalStore } from "react";

const CHAVE = "omni:tema";

function lerTema(): "claro" | "escuro" {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "escuro") return "escuro";
    if (v === "claro") return "claro";
  } catch { /* */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

function aplicar(tema: "claro" | "escuro") {
  document.documentElement.classList.toggle("dark", tema === "escuro");
}

let tema: "claro" | "escuro" = lerTema();
aplicar(tema);

const ouvintes = new Set<() => void>();

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
  ouvintes.forEach((fn) => fn());
}
