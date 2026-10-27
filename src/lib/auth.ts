import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { emitLojaChange } from "./loja-resolver";
import type { Session } from "@supabase/supabase-js";

type AuthState = {
  loading: boolean;
  session: Session | null;
  lojaId: string | null;
  nomeProprietario: string | null;
  papel: string | null;
};

let state: AuthState = { loading: true, session: null, lojaId: null, nomeProprietario: null, papel: null };
const listeners = new Set<() => void>();

function set(partial: Partial<AuthState>) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn());
}

async function carregarLoja(userId: string) {
  const { data, error } = await supabase
    .from("membros")
    .select("loja_id, nome, papel")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) console.error("[auth] carregarLoja error:", error.message);
  if (!data?.loja_id) console.warn("[auth] carregarLoja: nenhuma loja encontrada para", userId);
  set({ lojaId: data?.loja_id ?? null, nomeProprietario: data?.nome ?? null, papel: data?.papel ?? null });
  emitLojaChange(data?.loja_id ?? null);
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    set({ session: data.session });
    carregarLoja(data.session.user.id).then(() => set({ loading: false }));
  } else {
    // Se há um code PKCE ou token implícito na URL, o onAuthStateChange
    // vai disparar com SIGNED_IN assim que o exchange completar.
    // Mantemos loading: true para não redirecionar antes disso.
    const pendingOAuth =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("code") ||
        window.location.hash.includes("access_token"));
    if (!pendingOAuth) {
      set({ loading: false });
    }
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    set({ session, loading: true });
    carregarLoja(session.user.id).then(() => set({ loading: false }));
  } else {
    set({ session: null, lojaId: null, nomeProprietario: null, papel: null, loading: false });
    emitLojaChange(null);
  }
});

export async function recarregarLoja() {
  if (!state.session) return;
  await carregarLoja(state.session.user.id);
}

export function useAuth() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}

export function getAuthState() {
  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
