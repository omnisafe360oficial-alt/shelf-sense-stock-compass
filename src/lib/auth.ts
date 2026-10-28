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
    // Keep loading:true if there's an OAuth exchange in progress.
    // Supabase may have already removed ?code= from the URL before this runs,
    // so we also check the sessionStorage flag set by handleGoogle().
    const pendingOAuth =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("code") ||
        window.location.hash.includes("access_token") ||
        sessionStorage.getItem("oauth_pending") === "1");
    if (!pendingOAuth) {
      set({ loading: false });
    }
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    if (event === "SIGNED_IN") {
      // New sign-in (OAuth or password) — reload loja and keep spinner up
      if (typeof window !== "undefined") sessionStorage.removeItem("oauth_pending");
      set({ session, loading: true });
      carregarLoja(session.user.id).then(() => set({ loading: false }));
    } else {
      // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
      // Only call carregarLoja if this is a different user or loja hasn't been loaded yet.
      // This avoids setting loading:true on routine token refreshes (which caused the
      // Rules of Hooks crash in PainelLayout by toggling the early-return guard).
      const lojaJaCarregada =
        state.session?.user.id === session.user.id && state.lojaId !== null;
      if (!lojaJaCarregada) {
        set({ session, loading: true });
        carregarLoja(session.user.id).then(() => set({ loading: false }));
      } else {
        set({ session });
      }
    }
  } else {
    // No session. If we're waiting for an INITIAL_SESSION during an OAuth exchange,
    // stay loading so auth.callback.tsx doesn't redirect away prematurely.
    const oauthPending =
      typeof window !== "undefined" &&
      sessionStorage.getItem("oauth_pending") === "1";
    if (event === "INITIAL_SESSION" && oauthPending) {
      return;
    }
    if (typeof window !== "undefined") sessionStorage.removeItem("oauth_pending");
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
