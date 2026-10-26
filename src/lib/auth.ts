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
  const { data } = await supabase
    .from("membros")
    .select("loja_id, nome, papel")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  set({ lojaId: data?.loja_id ?? null, nomeProprietario: data?.nome ?? null, papel: data?.papel ?? null });
  emitLojaChange(data?.loja_id ?? null);
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    set({ session: data.session });
    carregarLoja(data.session.user.id).then(() => set({ loading: false }));
  } else {
    set({ loading: false });
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
