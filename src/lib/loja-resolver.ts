type Cb = (lojaId: string | null) => void;
const cbs = new Set<Cb>();
let current: string | null = null;
let fired = false;

export function onLojaChange(cb: Cb) {
  cbs.add(cb);
  if (fired) cb(current);
  return () => cbs.delete(cb);
}

export function emitLojaChange(id: string | null) {
  current = id;
  fired = true;
  cbs.forEach((fn) => fn(id));
}

export function getLojaId(): string | null {
  return current;
}
